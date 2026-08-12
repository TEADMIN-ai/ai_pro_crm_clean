import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION,
  buildContractorRepositoryDecision,
} from "@/lib/contractors/contractorRepositoryDecision";
import { resolveContractorReference } from "@/lib/contractors/contractorReferenceResolver";
import { buildSarsTcsProjection, type SarsTcsVerificationRecord } from "@/lib/sars-tcs";
import {
  buildOpportunityExecutionState,
  evaluateOpportunityCompliance,
  extractOpportunityRequirements,
  validateOpportunityTransition,
  type OpportunityExecutionPhase,
} from "@/lib/opportunities/opportunityExecution";
import { isPrivilegedRole, type AuthorizedUser } from "@/lib/server/authz";
import type { ContractorDocument } from "@/types/document";
import { evaluateContractorReadiness } from "@/lib/contractors/governedContractorResolution";
import { isStagingSimulationAllowed, isStagingSimulationRecord } from "@/lib/server/stagingSimulationSafety";

type AnyRecord = Record<string, unknown>;

export type ContractorAssignmentAuthorityDecision = {
  status: "ALLOWED" | "BLOCKED";
  blockers: string[];
  warnings: string[];
  contractorId: string | null;
  dealId: string;
  workspaceId: string | null;
  readinessDecisionStatus: "READY" | "BLOCKED" | "UNRESOLVED" | "STALE" | "UNKNOWN";
  decisionLogicVersion: string;
  contractor: (AnyRecord & { id: string }) | null;
  deal: (AnyRecord & { id: string }) | null;
  currentPhase: OpportunityExecutionPhase | null;
};

export class ContractorAssignmentAuthorityError extends Error {
  status: number;
  decision: ContractorAssignmentAuthorityDecision;

  constructor(decision: ContractorAssignmentAuthorityDecision, status = 409) {
    super("Contractor assignment blocked: " + decision.blockers.join("; "));
    this.name = "ContractorAssignmentAuthorityError";
    this.status = status;
    this.decision = decision;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    const parsed = value.toMillis();
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function contractorWorkspaceId(contractor: AnyRecord | null): string | null {
  if (!contractor) return null;
  const workspace = asRecord(contractor.workspace);
  return asString(contractor.workspaceId) ?? asString(workspace.id);
}

function isArchivedContractor(contractor: AnyRecord | null): boolean {
  return Boolean(contractor && (contractor.archived === true || asString(contractor.status)?.toLowerCase() === "archived"));
}

function isActiveContractor(contractor: AnyRecord | null): boolean {
  if (!contractor) return false;
  const status = asString(contractor.status)?.toLowerCase();
  return status === "active" || status === "approved";
}

function stripLegacyDocumentEvidence(contractor: AnyRecord): AnyRecord & { id: string } {
  const next = { ...contractor } as AnyRecord & { id: string };
  delete next.contractorDocuments;
  delete next.documentVault;
  delete next.documentAnalysisRecords;
  delete next.approvedComplianceRecords;
  delete next.profileLinkedDocuments;
  delete next.documentsByType;
  delete next.legacyDocuments;
  return next;
}

function normalizeDocument(docId: string, contractorId: string, data: AnyRecord): ContractorDocument & { documentId?: string } {
  return {
    id: docId,
    documentId: asString(data.documentId) ?? asString(data.Document_ID),
    contractorId: asString(data.contractorId) ?? contractorId,
    documentName: asString(data.documentName) ?? asString(data.fileName),
    documentType: asString(data.documentType) ?? asString(data.docType) ?? asString(data.complianceType),
    docType: asString(data.docType),
    fileName: asString(data.fileName),
    originalName: asString(data.originalName),
    filename: asString(data.filename),
    storagePath: asString(data.storagePath),
    fileUrl: asString(data.fileUrl) ?? asString(data.downloadURL) ?? asString(data.url),
    downloadURL: asString(data.downloadURL) ?? asString(data.fileUrl),
    verified: data.verified === true || toMillis(data.verifiedAt) !== null,
    verifiedAt: toMillis(data.verifiedAt) ?? undefined,
    verificationStatus: asString(data.verificationStatus) ?? undefined,
    validationStatus: data.validationStatus === "PASS" || data.validationStatus === "REVIEW" || data.validationStatus === "FAIL" ? data.validationStatus : undefined,
    validationError: asString(data.validationError),
    status: asString(data.status) ?? undefined,
    expiresAt: toMillis(data.expiresAt ?? data.expiryDate) ?? undefined,
    expiryDate: toMillis(data.expiryDate) ?? undefined,
    isExpired: data.isExpired === true,
    uploadedAt: toMillis(data.uploadedAt) ?? undefined,
    createdAt: toMillis(data.createdAt) ?? undefined,
    updatedAt: toMillis(data.updatedAt) ?? undefined,
    extractedAt: toMillis(data.extractedAt) ?? undefined,
  };
}

async function loadDeal(dealId: string): Promise<AnyRecord & { id: string } | null> {
  const snapshot = await getFirebaseAdmin().collection("deals").doc(dealId).get();
  return snapshot.exists ? { id: snapshot.id, ...(snapshot.data() ?? {}) } : null;
}

async function loadContractorDocuments(contractorId: string): Promise<ContractorDocument[]> {
  const snapshot = await getFirebaseAdmin().collection("contractors").doc(contractorId).collection("documents").get();
  return snapshot.docs.map((doc) => normalizeDocument(doc.id, contractorId, (doc.data() ?? {}) as AnyRecord));
}

function latestSarsRecord(records: SarsTcsVerificationRecord[]): SarsTcsVerificationRecord | null {
  if (!records.length) return null;
  return records.sort((left, right) => {
    const leftMillis = toMillis(left.updatedAt) ?? toMillis(left.verifiedAt) ?? toMillis(left.createdAt) ?? 0;
    const rightMillis = toMillis(right.updatedAt) ?? toMillis(right.verifiedAt) ?? toMillis(right.createdAt) ?? 0;
    return rightMillis - leftMillis;
  })[0] ?? null;
}

async function loadSarsTcsRecord(contractorId: string): Promise<SarsTcsVerificationRecord | null> {
  const snapshot = await getFirebaseAdmin().collection("contractors").doc(contractorId).collection("sarsTcs").get();
  return latestSarsRecord(snapshot.docs.map((doc) => ({ id: doc.id, ...((doc.data() ?? {}) as AnyRecord) }) as SarsTcsVerificationRecord));
}

async function actorWorkspaceId(actor: AuthorizedUser): Promise<string | null> {
  if (actor.workspaceId) return actor.workspaceId;
  const snapshot = await getFirebaseAdmin().collection("users").doc(actor.uid).get();
  return asString((snapshot.data() ?? {}).workspaceId);
}

function blocked(args: {
  blockers: string[];
  warnings?: string[];
  contractorId?: string | null;
  dealId: string;
  workspaceId?: string | null;
  readinessDecisionStatus?: ContractorAssignmentAuthorityDecision["readinessDecisionStatus"];
  contractor?: (AnyRecord & { id: string }) | null;
  deal?: (AnyRecord & { id: string }) | null;
  currentPhase?: OpportunityExecutionPhase | null;
}): ContractorAssignmentAuthorityDecision {
  return {
    status: "BLOCKED",
    blockers: unique(args.blockers),
    warnings: unique(args.warnings ?? []),
    contractorId: args.contractorId ?? null,
    dealId: args.dealId,
    workspaceId: args.workspaceId ?? null,
    readinessDecisionStatus: args.readinessDecisionStatus ?? "UNKNOWN",
    decisionLogicVersion: CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION,
    contractor: args.contractor ?? null,
    deal: args.deal ?? null,
    currentPhase: args.currentPhase ?? null,
  };
}

export async function evaluateContractorAssignmentAuthority(input: {
  dealId: string;
  contractorReference: string;
  actor: AuthorizedUser;
  targetPhase?: OpportunityExecutionPhase;
  deal?: AnyRecord & { id: string };
}): Promise<ContractorAssignmentAuthorityDecision> {
  const deal = input.deal ?? await loadDeal(input.dealId);
  if (!deal) return blocked({ dealId: input.dealId, blockers: ["Deal not found"] });
  const dealWorkspaceId = asString(deal.workspaceId);
  const actorWs = await actorWorkspaceId(input.actor);
  if (!isPrivilegedRole(input.actor.role)) {
    return blocked({ dealId: input.dealId, deal, workspaceId: dealWorkspaceId, blockers: ["Privileged actor role is required"] });
  }
  if (actorWs && dealWorkspaceId && actorWs !== dealWorkspaceId) {
    return blocked({ dealId: input.dealId, deal, workspaceId: dealWorkspaceId, blockers: ["Cross-workspace access rejected"] });
  }

  const resolved = await resolveContractorReference({
    reference: input.contractorReference,
    expectedWorkspaceId: null,
    actor: input.actor,
    dealId: input.dealId,
    logContext: "assignment_authority",
  });
  if (resolved.ok === false) {
    return blocked({ dealId: input.dealId, deal, workspaceId: dealWorkspaceId, blockers: [`Contractor reference rejected: ${resolved.failureReason}`] });
  }

  const contractor = stripLegacyDocumentEvidence(resolved.contractor);
  const contractorId = resolved.contractorId;
  const contractorWs = contractorWorkspaceId(contractor);
  const existingAssignment = asRecord(deal.contractorAssignment);
  const existingAssignedContractorId = asString(existingAssignment.contractorId);
  const idempotentReplay = existingAssignedContractorId === contractorId && asString(existingAssignment.assignmentStatus) === "assigned";
  const [documents, sarsRecord, executionWorkspaceSnapshot, submissionReviewSnapshot] = await Promise.all([
    loadContractorDocuments(contractorId),
    loadSarsTcsRecord(contractorId),
    getFirebaseAdmin().collection("opportunityExecutionWorkspaces").doc(input.dealId).get(),
    getFirebaseAdmin().collection("submissionReviews").doc(input.dealId).get(),
  ]);
  void executionWorkspaceSnapshot;
  void submissionReviewSnapshot;
  const allowStagingSimulation = isStagingSimulationAllowed();
  const repositoryDecision = buildContractorRepositoryDecision({ contractor: { ...contractor, sarsTcsSummary: sarsRecord ?? null }, documents, allowStagingSimulation });
  const sarsProjection = buildSarsTcsProjection({ record: sarsRecord, requiresLiveVerification: true, allowStagingSimulation });
  const currentContractor = { ...contractor, documents, sarsTcsSummary: sarsRecord ?? null };
  const governedReadiness = evaluateContractorReadiness({
    evidence: documents.map((document) => ({ complianceType: (document.documentType ?? document.docType) === "taxClearance" ? "SARS_TCS" : (document.documentType ?? document.docType) === "bbbee" ? "B-BBEE" : (document.documentType ?? document.docType) === "bankConfirmation" ? "BANK_CONFIRMATION" : document.documentType ?? document.docType, documentId: (document as ContractorDocument & { documentId?: string }).documentId ?? document.id, verificationStatus: isStagingSimulationRecord(document) && !allowStagingSimulation ? "SIMULATION_REJECTED" : document.verificationStatus, currentStatus: isStagingSimulationRecord(document) && !allowStagingSimulation ? "simulation_rejected" : document.status, issueDate: document.createdAt, expiryDate: document.expiresAt })),
    requiredTypes: readinessRequirements(deal),
    csdMaxAgeDays: csdFreshnessDays(deal),
  });
  const state = buildOpportunityExecutionState({ deal, contractor: currentContractor });
  const targetPhase = input.targetPhase ?? "COMPLIANCE_REVIEW";
  const transition = validateOpportunityTransition(state.currentPhase, targetPhase);
  const requirements = extractOpportunityRequirements(deal);
  const compliance = evaluateOpportunityCompliance(requirements, currentContractor, dealWorkspaceId);
  const blockers = [
    ...(isArchivedContractor(contractor) ? ["Contractor is archived and cannot receive new assignments."] : []),
    ...(isActiveContractor(contractor) ? [] : ["Contractor is not active"]),
    ...(!dealWorkspaceId ? ["Deal workspace is unresolved"] : []),
    ...(!contractorWs ? ["Contractor workspace is unresolved"] : []),
    ...(dealWorkspaceId && contractorWs && dealWorkspaceId !== contractorWs ? ["Contractor workspace does not match deal workspace"] : []),
    ...(repositoryDecision.identityStatus === "VERIFIED" ? [] : ["Contractor identity is unresolved"]),
    ...(repositoryDecision.assignmentAllowed === true ? [] : ["Canonical repository assignment authority is not ALLOWED"]),
    ...(repositoryDecision.logicVersion === CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION ? [] : ["Contractor readiness decision logic version is not current"]),
    ...(repositoryDecision.stale ? repositoryDecision.staleReasons : []),
    ...repositoryDecision.blockingReasons,
    ...governedReadiness.blockers,
    ...(sarsProjection.evidenceAvailable ? [] : ["SARS TCS supporting evidence is missing"]),
    ...(state.currentPhase === "MATCHING_REQUIRED" || idempotentReplay ? [] : [`Deal phase is ${state.currentPhase}, not MATCHING_REQUIRED`]),
    ...(transition.ok === false ? [transition.message] : []),
    ...(compliance.status === "VALID" ? [] : [...compliance.missing, ...compliance.expired.map((item) => `${item} expired`)]),
  ];
  const warnings = [
    ...repositoryDecision.warnings,
  ];
  const base = {
    warnings,
    contractorId,
    dealId: input.dealId,
    workspaceId: dealWorkspaceId,
    readinessDecisionStatus: repositoryDecision.readinessDecisionStatus,
    decisionLogicVersion: repositoryDecision.logicVersion,
    contractor: currentContractor,
    deal,
    currentPhase: state.currentPhase,
  } satisfies Omit<ContractorAssignmentAuthorityDecision, "status" | "blockers"> & { warnings: string[] };

  if (blockers.length) {
    return { ...base, status: "BLOCKED", blockers: unique(blockers), warnings: unique(warnings) };
  }
  return { ...base, status: "ALLOWED", blockers: [], warnings: unique(warnings) };
}

export function assertAssignmentAllowed(decision: ContractorAssignmentAuthorityDecision): void {
  if (decision.status !== "ALLOWED") throw new ContractorAssignmentAuthorityError(decision);
}
function readinessRequirements(deal: AnyRecord): string[] {
  const requirements = asRecord(asRecord(deal.opportunityExecution).requirements ?? deal.requirementsReview);
  return ["CIPC", "CSD", "SARS_TCS", ...(requirements.bbbeeRequirement ? ["B-BBEE"] : []), ...(requirements.coidaRequirement ? ["COIDA"] : []), ...(requirements.bankingRequirement ? ["BANK_CONFIRMATION"] : [])];
}
function csdFreshnessDays(deal: AnyRecord): number | null {
  const requirements = asRecord(asRecord(deal.opportunityExecution).requirements ?? deal.requirementsReview);
  const value = requirements.csdMaxAgeDays ?? requirements.csdEvidenceMaxAgeDays;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
