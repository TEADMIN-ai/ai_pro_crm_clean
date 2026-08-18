import {
  buildSubmissionReadiness,
  hasValidContractorApproval,
  hasValidInternalReviewCompletion,
  type OpportunityComplianceStatus,
  type OpportunityExecutionPhase,
  type OpportunityExecutionState,
  type OpportunityRequirementReview,
  type OpportunityTaskStatus,
  type ProcurementNextActionKey,
} from "@/lib/opportunities/opportunityExecution";
import type { ComplianceRemediationRequest, OpportunityRequirementDetail } from "@/lib/opportunities/opportunityComplianceRemediation";
import { buildSarsTcsProjection, type SarsTcsProjection, type SarsTcsVerificationRecord } from "@/lib/sars-tcs";

type AnyRecord = Record<string, unknown>;

export type ProcurementBlocker = {
  problem: string;
  reason: string;
  responsibleUser: string;
  actionRoute: string;
  dueDate: string | null;
};

export type ProcurementReadinessModel = {
  profileCompleteness: number;
  generalContractorCompliance: number;
  opportunityEligibility: number;
  supplierQuoteCoverage: number;
  tenderAnalysisCompleteness: number;
  pricingCompleteness: number;
  documentCompleteness: number;
  submissionReadiness: number | null;
};

export type ProcurementNextAction = {
  key: ProcurementNextActionKey;
  label: string;
  owner: string;
  dueBefore: string | null;
  blocker: string | null;
  actionKey: string | null;
  href?: string;
};

export type ProcurementExecutionProjection = {
  workspaceId: string | null;
  opportunityId: string;
  dealId: string;
  contractorId: string | null;
  contractorName: string | null;
  currentPhase: OpportunityExecutionPhase;
  readiness: ProcurementReadinessModel;
  blockers: ProcurementBlocker[];
  nextAction: ProcurementNextAction;
  assignedOwner: string;
  dueDate: string | null;
  complianceStatus: OpportunityComplianceStatus;
  complianceRequirements: OpportunityRequirementDetail[];
  complianceBlockers: ProcurementBlocker[];
  sarsBlockers: ProcurementBlocker[];
  remediationTaskIds: string[];
  taxDocumentStatus: string;
  sarsVerificationStatus: SarsTcsProjection["sarsVerificationStatus"];
  sarsVerifiedAt: string | null;
  sarsRecheckDueAt: string | null;
  sarsIdentityMatch: SarsTcsProjection["sarsIdentityMatch"];
  sarsVerificationBlockers: string[];
  sarsVerificationRequired: boolean;
  sarsVerificationRoute: string | null;
  sarsNextAction: SarsTcsProjection["sarsNextAction"];
  sarsVerifiedByName: string | null;
  sarsVerificationSource: SarsTcsProjection["source"];
  sarsEvidenceAvailable: boolean;
  supplierQuoteStatus: string;
  supplierQuoteIds: string[];
  approvedSupplierQuoteIds: string[];
  quoteCoverage: number;
  quoteBlockers: ProcurementBlocker[];
  tenderIntelligenceId: string | null;
  tenderAnalysisStatus: string;
  requirementsReviewStatus: string;
  pricingClassification: string;
  extractedLineItemCount: number;
  intelligenceBlockers: ProcurementBlocker[];
  tenderPricingId: string | null;
  pricingStatus: string;
  pricingApproved: boolean;
  pricingDocumentId: string | null;
  totalTenderValue: number;
  grossProfit: number;
  grossMargin: number;
  pricingBlockers: ProcurementBlocker[];
  documentPreparationStatus: OpportunityTaskStatus;
  returnablesStatus: OpportunityTaskStatus;
  signatureStatus: OpportunityTaskStatus;
  amendmentStatus: OpportunityTaskStatus;
  submissionReviewId: string | null;
  reviewStatus: OpportunityTaskStatus;
  packStatus: string;
  submissionReadiness: number | null;
  submissionStatus: OpportunityTaskStatus;
  decisionStatus: "ALLOWED" | "BLOCKED" | "UNKNOWN" | "UNRESOLVED" | "DATA_ERROR";
  readinessStatus: "READY" | "BLOCKED" | "UNKNOWN" | "UNRESOLVED";
  readinessScore: number | null;
  assignmentAllowed: boolean;
  eligible: boolean;
  blockingReasons: string[];
  warnings: string[];
  evaluatedAt: string | null;
  logicVersion: string | null;
  stale: boolean | null;
  contractorIdentityStatus: "RESOLVED" | "UNRESOLVED";
  workspaceResolutionStatus: "RESOLVED" | "UNRESOLVED";
};

function rec(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function pct(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

function arr<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function taskStatus(value: unknown, completeValues: string[] = ["COMPLETE", "APPROVED", "VALIDATED", "LOCKED"]): OpportunityTaskStatus {
  const normalized = String(value ?? "").toUpperCase();
  if (completeValues.includes(normalized)) return "complete";
  if (normalized.includes("BLOCK") || normalized.includes("FAIL") || normalized.includes("MISSING")) return "blocked";
  if (normalized.includes("PROGRESS") || normalized.includes("REVIEW") || normalized.includes("PENDING")) return "in_progress";
  if (normalized.includes("NOT_APPLICABLE")) return "not_applicable";
  return "not_started";
}

function blocker(problem: string, reason: string, responsibleUser: string, actionRoute: string, dueDate: string | null): ProcurementBlocker {
  return { problem, reason, responsibleUser, actionRoute, dueDate };
}

function lineItemsRequired(requirements: OpportunityRequirementReview, intelligence: AnyRecord): boolean {
  const classification = str(intelligence.pricingClassification) ?? str(intelligence.boqClassification);
  if (classification === "NO_PRICING_REQUIRED" || classification === "FORM_OF_OFFER_ONLY") return false;
  return requirements.boqPricingSchedulePresent || ["EMBEDDED_BOQ", "EMBEDDED_PRICING_SCHEDULE", "RATE_SCHEDULE", "SEPARATE_BOQ_DOCUMENT", "PRICING_REQUIRED_BUT_TEMPLATE_NOT_FOUND"].includes(classification ?? "");
}

function approvedQuoteIdsFrom(deal: AnyRecord, execution: AnyRecord, pricing: AnyRecord): string[] {
  const quotes = arr<AnyRecord>(deal.supplierQuotes ?? execution.supplierQuotes);
  const fromQuotes = quotes.filter((quote) => ["APPROVED", "LOCKED"].includes(String(quote.approvalStatus ?? "").toUpperCase())).map((quote) => str(quote.id)).filter(Boolean) as string[];
  const canonicalIds = pricing.lockStatus === "LOCKED" && pricing.validationStatus === "VALIDATED" ? arr<string>(pricing.approvedSupplierQuoteIds) : [];
  if (canonicalIds.length) return Array.from(new Set(canonicalIds));
  return Array.from(new Set(fromQuotes));
}

export function hasGovernedLockedPricing(value: unknown): boolean { const pricing = rec(value); const approvals = arr<AnyRecord>(pricing.approvals); const currentApproval = (role: string) => approvals.some((approval) => approval.revision === pricing.revision && approval.role === role && Boolean(approval.approvedBy && approval.approvedAt)); const directorRequired = pricing.managementApprovalStatus === "DIRECTOR_REQUIRED"; const pricedDocumentId = str(pricing.pricingDocumentId) ?? str(rec(pricing.documentFillEvidence).pricedDocumentId); const lines = arr<AnyRecord>(pricing.lineItems); const completeLines = lines.length > 0 && lines.every((line) => Boolean(rec(line.mapping).supplierQuoteId)); const blockers = arr<AnyRecord>(pricing.blockers).filter((item) => String(item.severity ?? "BLOCKER").toUpperCase() === "BLOCKER"); const handoff = rec(pricing.submissionReviewHandoff); return pricing.lockStatus === "LOCKED" && pricing.validationStatus === "VALIDATED" && Boolean(pricedDocumentId) && completeLines && currentApproval("staff") && currentApproval("manager") && (!directorRequired || currentApproval("director")) && blockers.length === 0 && handoff.pricingApproved === true && handoff.workflowTransition === "DOCUMENT_PREPARATION"; }

function supplierQuoteIdsFrom(deal: AnyRecord, execution: AnyRecord): string[] {
  const quotes = arr<AnyRecord>(deal.supplierQuotes ?? execution.supplierQuotes);
  return Array.from(new Set([...quotes.map((quote) => str(quote.id)), ...arr<string>(execution.supplierQuoteIds)].filter(Boolean) as string[]));
}

function sarsActionLabel(key: SarsTcsProjection['sarsNextAction']): string {
  if (key === 'REQUEST_TCS_PIN') return 'Request SARS TCS PIN';
  if (key === 'VERIFY_TCS_WITH_SARS') return 'Verify SARS TCS';
  if (key === 'RESOLVE_TAX_IDENTITY_MISMATCH') return 'Resolve SARS identity mismatch';
  if (key === 'REQUEST_TAX_REMEDIATION') return 'Resolve SARS non-compliance';
  if (key === 'REVERIFY_TCS') return 'Reverify SARS TCS';
  return 'Complete SARS verification';
}

function buildNextAction(input: {
  state: OpportunityExecutionState;
  assignmentValid: boolean;
  complianceBlockers: ProcurementBlocker[];
  sarsBlockers: ProcurementBlocker[];
  sarsNextAction: SarsTcsProjection['sarsNextAction'];
  quoteBlockers: ProcurementBlocker[];
  intelligenceBlockers: ProcurementBlocker[];
  pricingBlockers: ProcurementBlocker[];
  mappingIncomplete: boolean;
  pricingIncomplete: boolean;
  pricingAwaitingApproval: boolean;
  pricedDocumentMissing: boolean;
  documentsIncomplete: boolean;
  submissionReviewIncomplete: boolean;
  tenderPackMissing: boolean;
  ready: boolean;
}): ProcurementNextAction {
  const due = input.state.dueDate;
  const make = (key: ProcurementNextActionKey, label: string, owner: string, blockerText: string | null, actionKey: string | null, href?: string): ProcurementNextAction => ({
    key,
    label,
    owner,
    dueBefore: due,
    blocker: blockerText,
    actionKey,
    href,
  });
  if (!input.assignmentValid) return make("ASSIGN_CONTRACTOR", "Assign Torque Empire as bidder", "staff", "A valid bidder assignment is required.", "assign_contractor");
  if (input.sarsBlockers.length) return make(input.sarsNextAction, sarsActionLabel(input.sarsNextAction), 'compliance', input.sarsBlockers[0].problem, 'open_missing_documents', input.sarsBlockers[0].actionRoute);
  if (input.complianceBlockers.length) return make("REMEDIATE_COMPLIANCE", "Remediate contractor compliance", "compliance", input.complianceBlockers[0].problem, "open_missing_documents", input.complianceBlockers[0].actionRoute);
  if (input.quoteBlockers.length) return make("UPLOAD_OR_APPROVE_SUPPLIER_QUOTE", "Upload or approve supplier quote", "staff", input.quoteBlockers[0].problem, "open_supplier_quotes", input.quoteBlockers[0].actionRoute);
  if (input.intelligenceBlockers.length) return make("REVIEW_TENDER_ANALYSIS", "Review tender analysis", "staff", input.intelligenceBlockers[0].problem, "open_tender_intelligence", input.intelligenceBlockers[0].actionRoute);
  if (input.mappingIncomplete) return make("MAP_QUOTES_TO_TENDER_LINES", "Map quotes to tender lines", "qs", "Tender lines are not fully mapped to approved quote lines.", "open_boq_pricing", "/dashboard/deals/" + encodeURIComponent(input.state.dealId) + "/tender-pricing");
  if (input.pricingIncomplete) return make("COMPLETE_PRICING", "Complete tender pricing", "qs", "Pricing calculations are incomplete.", "open_boq_pricing", "/dashboard/deals/" + encodeURIComponent(input.state.dealId) + "/tender-pricing");
  if (input.pricingAwaitingApproval) return make("APPROVE_PRICING", "Approve tender pricing", "manager", "Pricing is awaiting manager/director approval.", "open_boq_pricing", "/dashboard/deals/" + encodeURIComponent(input.state.dealId) + "/tender-pricing");
  if (input.pricedDocumentMissing) return make("GENERATE_PRICED_DOCUMENT", "Generate priced document", "qs", "Approved pricing has not produced validated fill evidence.", "open_boq_pricing", "/dashboard/deals/" + encodeURIComponent(input.state.dealId) + "/tender-pricing");
  if (input.documentsIncomplete) return make("COMPLETE_DOCUMENTS", "Complete returnable documents", "staff", "Mandatory returnables, signatures, or amendments are incomplete.", "prepare_documents");
  if (input.submissionReviewIncomplete) return make("COMPLETE_SUBMISSION_REVIEW", "Complete Submission Review", "manager", "Internal Submission Review is not approved.", "open_submission_review", "/dashboard/submission-review?dealId=" + encodeURIComponent(input.state.dealId));
  if (input.tenderPackMissing) return make("GENERATE_TENDER_PACK", "Generate tender pack", "operations", "The final tender pack is not generated and validated.", "generate_tender_pack", "/dashboard/tender-pack-requests");
  if (input.ready) return make("READY_FOR_SUBMISSION", "Ready for submission", "manager", null, "record_submission");
  return make("RECORD_SUBMISSION", "Record submission", "operations", null, "record_submission");
}

export function buildProcurementExecutionProjection(input: {
  deal: unknown;
  state: OpportunityExecutionState;
  remediationRequests: ComplianceRemediationRequest[];
}): ProcurementExecutionProjection {
  const deal = rec(input.deal);
  const execution = rec(deal.opportunityExecution);
  const state = input.state;
  const dueDate = state.dueDate;
  const dealId = state.dealId || String(deal.id ?? "");
  const pricing = rec(deal.tenderPricing ?? execution.tenderPricing ?? deal.pricing);
  const canonicalPricingComplete = hasGovernedLockedPricing(pricing);
  const supplierQuoteIds = supplierQuoteIdsFrom(deal, execution);
  const approvedSupplierQuoteIds = approvedQuoteIdsFrom(deal, execution, pricing);
  const quoteCoverage = canonicalPricingComplete ? 100 : pct(execution.lineItemCoverage ?? execution.quoteCoverage ?? (approvedSupplierQuoteIds.length ? 100 : supplierQuoteIds.length ? 50 : 0));
  const supplierQuoteStatus = str(execution.supplierQuotesStatus) ?? (approvedSupplierQuoteIds.length ? "APPROVED" : supplierQuoteIds.length ? "UPLOADED" : "NOT_STARTED");
  const intelligence = rec(deal.tenderIntelligence ?? execution.tenderIntelligence);
  const tenderIntelligenceId = str(intelligence.id) ?? str(execution.tenderIntelligenceId);
  const tenderAnalysisStatus = str(execution.tenderAnalysisStatus) ?? str(intelligence.analysisStatus) ?? "NOT_STARTED";
  const requirementsReviewStatus = str(execution.requirementsReviewStatus) ?? str(intelligence.reviewStatus) ?? (state.requirements.reviewed ? "APPROVED" : "PENDING");
  const pricingClassification = str(execution.pricingClassification) ?? str(intelligence.boqClassification) ?? str(intelligence.pricingClassification) ?? (state.pricingRequired ? "MANUAL_REVIEW_REQUIRED" : "NO_PRICING_REQUIRED");
  const extractedLineItemCount = arr(intelligence.extractedLineItems ?? execution.tenderLineItems).length || pct(execution.extractedLineItemCount);

  const tenderPricingId = str(pricing.id) ?? str(execution.tenderPricingId);
  const pricingStatus = str(pricing.pricingStatus) ?? str(execution.pricingStatus) ?? "NOT_STARTED";
  const pricingApproved = bool(execution.pricingApproved) || ["APPROVED", "LOCKED", "VALIDATED"].includes(pricingStatus.toUpperCase()) || bool(pricing.pricingApproved);
  const pricingDocumentId = str(execution.pricingDocumentId) ?? str(pricing.pricingDocumentId) ?? str(rec(pricing.documentFillEvidence).pricedDocumentId);
  const totalTenderValue = Number(execution.totalTenderValue ?? pricing.total ?? 0) || 0;
  const grossProfit = Number(execution.grossProfit ?? pricing.grossProfit ?? 0) || 0;
  const grossMargin = Number(execution.grossMargin ?? pricing.grossMarginPercentage ?? pricing.grossMargin ?? 0) || 0;
  const pricingBlockers = arr<AnyRecord>(pricing.blockers ?? execution.pricingBlockers).map((item) => blocker(str(item.message) ?? str(item.code) ?? "Pricing blocker", "Pricing validation must pass before submission.", "qs", "/dashboard/deals/" + encodeURIComponent(dealId) + "/tender-pricing", dueDate));
  const pricingRequired = lineItemsRequired(state.requirements, intelligence);
  const quoteBlockers = pricingRequired && !approvedSupplierQuoteIds.length
    ? [blocker("No approved supplier quote", "Supplier prices are required before tender pricing can be calculated.", "staff", "/dashboard/deals/" + encodeURIComponent(dealId) + "/supplier-quotes", dueDate)]
    : quoteCoverage < 100 && pricingRequired
      ? [blocker("Supplier quote coverage is incomplete", "Every required line needs approved quote coverage or an approved exception.", "staff", "/dashboard/deals/" + encodeURIComponent(dealId) + "/supplier-quotes", dueDate)]
      : [];
  const intelligenceBlockers = requirementsReviewStatus !== "APPROVED"
    ? [blocker("Tender intelligence is not approved", "Staff must approve the analysed tender facts and pricing schedule detection.", "staff", "/dashboard/deals/" + encodeURIComponent(dealId) + "/tender-intelligence", dueDate)]
    : [];
  const complianceBlockers = state.complianceRequirements
    .filter((requirement) => requirement.blockerSeverity !== "none")
    .map((requirement) => blocker(requirement.reason, "Compulsory bidder compliance must be valid before submission.", requirement.responsiblePerson, "/dashboard/contractors/" + encodeURIComponent(state.contractorId ?? ""), requirement.dueDate ?? dueDate));
  const sarsRecord = rec(deal.sarsTcsSummary ?? execution.sarsTcsSummary) as Partial<SarsTcsVerificationRecord>;
  const sarsProjection = buildSarsTcsProjection({ record: Object.keys(sarsRecord).length ? sarsRecord as SarsTcsVerificationRecord : null, taxDocumentStatus: state.complianceChecks.find((check) => check.key === "tax")?.status ?? "unknown", route: state.contractorId ? "/dashboard/contractors/" + encodeURIComponent(state.contractorId) : null, requiresLiveVerification: state.requirements.sarsVerificationRequired });
  const sarsBlockerReason = state.requirements.sarsVerificationRequired ? 'Tender requires current live SARS TCS verification.' : 'Existing SARS TCS verification result requires resolution.';
  const sarsBlockers = sarsProjection.sarsVerificationBlockers.map((item) => blocker(item, sarsBlockerReason, 'compliance', sarsProjection.sarsVerificationRoute ?? '/dashboard/deals/' + encodeURIComponent(dealId) + '/execution', sarsProjection.sarsRecheckDueAt ?? dueDate));
  const allComplianceBlockers = [...complianceBlockers, ...sarsBlockers];
  const requiredDocuments = state.documentChecklist.filter((item) => item.required);
  const documentsComplete = requiredDocuments.length > 0 && requiredDocuments.every((item) => item.status === "COMPLETE");
  const documentCompleteness = state.documentChecklist.length ? pct((state.documentChecklist.filter((item) => item.status === "COMPLETE" || item.status === "NOT_APPLICABLE").length / state.documentChecklist.length) * 100) : 0;
  const tenderAnalysisCompleteness = requirementsReviewStatus === "APPROVED" ? 100 : tenderAnalysisStatus === "ANALYSIS_COMPLETE" || tenderAnalysisStatus === "REVIEW_REQUIRED" ? 75 : tenderAnalysisStatus === "ANALYSING" ? 40 : 0;
  const mappingIncomplete = pricingRequired && (String(rec(pricing).mappingStatus ?? execution.mappingStatus ?? "").toUpperCase().includes("MAPPING_REQUIRED") || pricingStatus === "MAPPING_REQUIRED");
  const pricingIncomplete = pricingRequired && !pricingApproved && ["NOT_STARTED", "SOURCE_QUOTES_REQUIRED", "TENDER_ANALYSIS_REQUIRED", "PRICING_IN_PROGRESS", "VALIDATION_FAILED"].includes(pricingStatus.toUpperCase());
  const pricingAwaitingApproval = pricingRequired && !pricingApproved && ["REVIEW_REQUIRED", "MANAGER_APPROVAL_REQUIRED", "DIRECTOR_APPROVAL_REQUIRED"].includes(pricingStatus.toUpperCase());
  const pricedDocumentMissing = pricingRequired && pricingApproved && (!pricingDocumentId || String(rec(pricing).validationStatus ?? execution.pricingValidationStatus ?? "").toUpperCase() === "VALIDATION_FAILED");
  const submissionReview = rec(deal.submissionReview ?? execution.submissionReview);
  const submissionReviewId = str(submissionReview.id) ?? str(execution.submissionReviewId);
  const reviewStatus = taskStatus(submissionReview.reviewStatus ?? submissionReview.approvalStatus ?? execution.submissionReviewStatus, ["APPROVED", "COMPLETE"]);
  const packStatus = str(execution.packStatus) ?? str(rec(deal.tenderPack).packStatus) ?? (bool(execution.tenderPackGenerated) && bool(execution.tenderPackValidated) ? "VALIDATED" : "NOT_STARTED");
  const packReady = hasValidInternalReviewCompletion(deal) && hasValidContractorApproval(deal) && (["VALIDATED", "GENERATED"].includes(packStatus.toUpperCase()) || (bool(execution.tenderPackGenerated) && bool(execution.tenderPackValidated)));
  const readinessModel: ProcurementReadinessModel = {
    profileCompleteness: state.profileCompleteness,
    generalContractorCompliance: state.generalCompliance,
    opportunityEligibility: state.complianceStatus === "VALID" && state.contractorId ? 100 : state.contractorId ? 50 : 0,
    supplierQuoteCoverage: quoteCoverage,
    tenderAnalysisCompleteness,
    pricingCompleteness: !pricingRequired ? 100 : pricingApproved && pricingDocumentId ? 100 : pricingApproved ? 85 : pricingStatus === "REVIEW_REQUIRED" ? 70 : mappingIncomplete ? 45 : 0,
    documentCompleteness,
    submissionReadiness: state.submissionReadiness,
  };
  const submission = buildSubmissionReadiness({
    state,
    pricingComplete: !pricingRequired || pricingApproved,
    documentsComplete,
    internalReviewApproved: hasValidInternalReviewCompletion(deal),
    signaturesComplete: !state.requirements.signatureRequired || state.documentChecklist.find((item) => item.key === "signatures")?.status === "COMPLETE",
    packGenerated: packReady,
    packValidated: packReady,
  });
  const ready = submission.ready && !quoteBlockers.length && !intelligenceBlockers.length && !pricingBlockers.length && (!pricingRequired || Boolean(pricingDocumentId));
  const nextAction = buildNextAction({
    state,
    assignmentValid: state.assignment.complete,
    complianceBlockers: allComplianceBlockers,
    sarsBlockers,
    sarsNextAction: sarsProjection.sarsNextAction,
    quoteBlockers,
    intelligenceBlockers,
    pricingBlockers,
    mappingIncomplete,
    pricingIncomplete,
    pricingAwaitingApproval,
    pricedDocumentMissing,
    documentsIncomplete: !documentsComplete,
    submissionReviewIncomplete: reviewStatus !== "complete",
    tenderPackMissing: !packReady,
    ready,
  });
  const blockers = [...allComplianceBlockers, ...quoteBlockers, ...intelligenceBlockers, ...pricingBlockers, ...submission.blockers.map((item) => blocker(item, "Submission readiness requires this prerequisite.", nextAction.owner, nextAction.href ?? "/dashboard/deals/" + encodeURIComponent(dealId) + "/execution", dueDate))];
  const contractorIdentityStatus = state.contractorId ? "RESOLVED" : "UNRESOLVED";
  const workspaceResolutionStatus = str(deal.workspaceId) ? "RESOLVED" : "UNRESOLVED";
  const eligible = contractorIdentityStatus === "RESOLVED" && workspaceResolutionStatus === "RESOLVED" && state.complianceStatus === "VALID" && allComplianceBlockers.length === 0;
  const blockingReasons = Array.from(new Set([...blockers.map((item) => item.problem), ...state.blockers]));
  const assignmentAllowed = eligible && blockingReasons.length === 0;
  const decisionStatus: ProcurementExecutionProjection["decisionStatus"] = contractorIdentityStatus === "UNRESOLVED" || workspaceResolutionStatus === "UNRESOLVED" ? "UNRESOLVED" : ready && blockingReasons.length === 0 ? "ALLOWED" : "BLOCKED";
  const readinessStatus: ProcurementExecutionProjection["readinessStatus"] = ready && blockingReasons.length === 0 ? "READY" : decisionStatus === "UNRESOLVED" ? "UNRESOLVED" : "BLOCKED";
  const readinessScore = readinessStatus === "READY" ? 100 : null;
  return {
    workspaceId: str(deal.workspaceId),
    opportunityId: String(deal.opportunityId ?? deal.id ?? dealId),
    dealId,
    contractorId: state.contractorId,
    contractorName: state.contractorName,
    currentPhase: readinessStatus === "READY" ? "READY_FOR_SUBMISSION" : state.currentPhase,
    readiness: readinessModel,
    blockers,
    nextAction,
    assignedOwner: nextAction.owner,
    dueDate,
    complianceStatus: state.complianceStatus,
    complianceRequirements: state.complianceRequirements,
    complianceBlockers: allComplianceBlockers,
    sarsBlockers,
    remediationTaskIds: input.remediationRequests.map((request) => request.id),
    taxDocumentStatus: sarsProjection.taxDocumentStatus,
    sarsVerificationStatus: sarsProjection.sarsVerificationStatus,
    sarsVerifiedAt: sarsProjection.sarsVerifiedAt,
    sarsRecheckDueAt: sarsProjection.sarsRecheckDueAt,
    sarsIdentityMatch: sarsProjection.sarsIdentityMatch,
    sarsVerificationBlockers: sarsProjection.sarsVerificationBlockers,
    sarsVerificationRequired: state.requirements.sarsVerificationRequired,
    sarsVerificationRoute: sarsProjection.sarsVerificationRoute,
    sarsNextAction: sarsProjection.sarsNextAction,
    sarsVerifiedByName: sarsProjection.verifiedByName,
    sarsVerificationSource: sarsProjection.source,
    sarsEvidenceAvailable: sarsProjection.evidenceAvailable,
    supplierQuoteStatus,
    supplierQuoteIds,
    approvedSupplierQuoteIds,
    quoteCoverage,
    quoteBlockers,
    tenderIntelligenceId,
    tenderAnalysisStatus,
    requirementsReviewStatus,
    pricingClassification,
    extractedLineItemCount,
    intelligenceBlockers,
    tenderPricingId,
    pricingStatus,
    pricingApproved,
    pricingDocumentId,
    totalTenderValue,
    grossProfit,
    grossMargin,
    pricingBlockers,
    documentPreparationStatus: state.documentStatus,
    returnablesStatus: documentsComplete ? "complete" : "blocked",
    signatureStatus: state.requirements.signatureRequired ? taskStatus(state.documentChecklist.find((item) => item.key === "signatures")?.status) : "not_applicable",
    amendmentStatus: state.requirements.annexuresAndAmendments.length ? taskStatus(state.documentChecklist.find((item) => item.key === "amendments")?.status) : "not_applicable",
    submissionReviewId,
    reviewStatus,
    packStatus,
    submissionReadiness: readinessScore,
    submissionStatus: state.submissionStatus,
    decisionStatus,
    readinessStatus,
    readinessScore,
    assignmentAllowed,
    eligible,
    blockingReasons,
    warnings: [],
    evaluatedAt: str(execution.decisionEvaluatedAt),
    logicVersion: str(execution.decisionLogicVersion),
    stale: typeof execution.decisionStale === "boolean" ? execution.decisionStale : null,
    contractorIdentityStatus,
    workspaceResolutionStatus,
  };
}

export function tenderPackGenerationBlockers(projection: ProcurementExecutionProjection): ProcurementBlocker[] {
  const blockers: ProcurementBlocker[] = [];
  const dueDate = projection.dueDate;
  const route = "/dashboard/deals/" + encodeURIComponent(projection.dealId) + "/execution";
  if (projection.complianceStatus !== "VALID") {
    blockers.push(blocker("Compliance expired or missing", "Compulsory bidder compliance must be valid before a pack can be generated.", "compliance", projection.contractorId ? "/dashboard/contractors/" + encodeURIComponent(projection.contractorId) : route, dueDate));
  }
  if (projection.pricingClassification !== "NO_PRICING_REQUIRED" && !projection.pricingApproved) {
    blockers.push(blocker("Pricing is not approved", "Only approved tender pricing may be inserted into the final tender pack.", "manager", "/dashboard/deals/" + encodeURIComponent(projection.dealId) + "/tender-pricing", dueDate));
  }
  if (projection.pricingClassification !== "NO_PRICING_REQUIRED" && !projection.pricingDocumentId) {
    blockers.push(blocker("Approved priced document is missing", "The generated pack must include the validated priced document evidence.", "qs", "/dashboard/deals/" + encodeURIComponent(projection.dealId) + "/tender-pricing", dueDate));
  }
  if (projection.pricingBlockers.length) blockers.push(...projection.pricingBlockers);
  if (projection.returnablesStatus !== "complete") {
    blockers.push(blocker("Mandatory returnables are incomplete", "All compulsory returnables, SBD forms, declarations, annexures, and amendments must be complete.", "staff", route, dueDate));
  }
  if (projection.signatureStatus !== "complete" && projection.signatureStatus !== "not_applicable") {
    blockers.push(blocker("Required signatures are incomplete", "Submission documents must carry required bidder signatures before packing.", "staff", route, dueDate));
  }
  if (projection.packStatus === "SUPERSEDED") {
    blockers.push(blocker("Pack documents are superseded", "Superseded or invalid documents cannot be used for the final pack.", "operations", "/dashboard/tender-pack-requests", dueDate));
  }
  return blockers;
}
