import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  computeContractorIdentitySourceFingerprint,
  stableStringifyContractorIdentityResolution,
  type ContractorIdentityResolutionBeforeState,
  type ContractorManualIdentityResolutionProposal,
} from "@/lib/contractors/contractorIdentityResolution";
import type {
  ContractorDecisionAuditReport,
  ContractorDecisionAuditSnapshot,
} from "@/lib/contractors/contractorDecisionAudit";

export const CONTRACTOR_IDENTITY_APPLY_LOGIC_VERSION = "contractor-identity-resolution-apply-v1";
export const ALLOWLISTED_CONTRACTOR_ID = "z0yX8cyt38hkfa60UEyNTOiX2812";
export const PRODUCTION_CONFIRMATION = "APPLY_IDENTITY_ONLY_z0yX8cyt38hkfa60UEyNTOiX2812_NO_REFERENCE_NO_READINESS_NO_COMPLIANCE_NO_ASSIGNMENT";
export const ALLOWLIST_CONFIRMATION = "ALLOWLIST_ONLY_CONTRACTOR_z0yX8cyt38hkfa60UEyNTOiX2812";
export const REVIEWER_CONFIRMATION = "REVIEWED_BY_CHADWIN_WESLEY_KARANIE_FOR_TORQUE_EMPIRE_IDENTITY_ONLY";

export const ALLOWED_IDENTITY_FIELD_PATHS = [
  "legalName",
  "tradingName",
  "companyRegistrationNumber",
  "identityStatus",
  "identityResolved",
  "identityMatchStatus",
  "manualResolution",
] as const;

export const FORBIDDEN_MUTATION_FIELD_PATHS = [
  "readinessScore", "readinessStatus", "complianceStatus", "complianceApproved",
  "assignmentAllowed", "assignmentStatus", "assignedContractorId", "tenderLockStatus",
  "csdNumber", "csdMNumber", "mNumber", "recommendations", "assignments", "deals",
  "workspaceId", "userId", "uid", "authUid", "contractorId", "canonicalContractorFacingReference",
  "contractorReference", "teosContractorReference", "historicalDecision", "registrationNumber",
] as const;

type JsonRecord = Record<string, unknown>;

export type VerifiedBusinessIdentityEvidenceForApply = {
  contractorDocumentId: string;
  contractorIsolationStatus: string;
  verificationStatus: string;
  legalBusinessName: string;
  companyRegistrationNumber: string;
  primarySourceDocumentSHA256: string;
  supportingSourceDocumentSHA256: string;
  controls?: Record<string, unknown>;
};

export type ContractorIdentityApplyInput = {
  contractorId: string;
  proposal: ContractorManualIdentityResolutionProposal;
  snapshot: ContractorDecisionAuditSnapshot;
  auditReport: ContractorDecisionAuditReport;
  proposalPath: string;
  snapshotPath: string;
  auditPath: string;
  verifiedBusinessIdentityEvidencePath: string;
  verifiedBusinessIdentityEvidence: VerifiedBusinessIdentityEvidenceForApply;
  expectedBeforeStateFingerprint: string;
  operationId?: string;
};

export type ContractorIdentityApplyPlan = {
  planType: "CONTRACTOR_IDENTITY_RESOLUTION_APPLY";
  mode: "DRY_RUN_PLAN_ONLY";
  productionExecutionAllowed: false;
  firebaseReadOccurred: false;
  firebaseWriteOccurred: false;
  operationId: string;
  contractorDocumentPath: `contractors/${string}`;
  contractorId: string;
  sourcePaths: { proposal: string; snapshot: string; audit: string; verifiedEvidence: string };
  expectedBeforeStateFingerprint: string;
  computedBeforeStateFingerprint: string;
  beforeState: ContractorIdentityResolutionBeforeState;
  proposedIdentityFields: Record<string, unknown>;
  allowedFieldPaths: readonly string[];
  forbiddenFieldPaths: readonly string[];
  protectedDecisions: {
    csd: "UNCHANGED_INVALID_OR_UNRESOLVED";
    readiness: "UNCHANGED";
    compliance: "UNCHANGED";
    assignmentAllowed: false;
    contractorReference: "NOT_ISSUED";
  };
  backupPlan: {
    requiredBeforeWrite: true;
    localRollbackDirectory: "reports/contractors/rollback";
    liveBackupCreated: false;
    fieldLevelBeforeValues: string[];
  };
  transactionPlan: {
    directContractorReadOnly: true;
    broadCollectionScan: false;
    revalidateInsideTransaction: true;
    auditCollection: "auditLogs";
    identityFieldsOnly: true;
  };
  rollbackPlan: {
    contractorScoped: true;
    requiresOperationId: true;
    requiresBackupSHA256: true;
    restoresOnlyAllowedIdentityFields: true;
    refusesUnexpectedPostApplyFingerprint: true;
  };
  auditEventDraft: Record<string, unknown>;
};

export type ApplyDocumentReference = {
  path: string;
  get(): Promise<{ exists: boolean; id: string; data(): JsonRecord | undefined }>;
};

export type ApplyTransaction = {
  get(reference: ApplyDocumentReference): Promise<{ exists: boolean; id: string; data(): JsonRecord | undefined }>;
  update(reference: ApplyDocumentReference, values: Record<string, unknown>): void;
  create(reference: ApplyDocumentReference, values: Record<string, unknown>): void;
};

export type ApplyFirestore = {
  collection(name: "contractors" | "auditLogs"): { doc(id: string): ApplyDocumentReference };
  runTransaction<T>(callback: (transaction: ApplyTransaction) => Promise<T>): Promise<T>;
};

export class ContractorIdentityResolutionApplyError extends Error {
  constructor(public readonly code: string, message: string, public readonly evidence: JsonRecord = {}) {
    super(message);
    this.name = "ContractorIdentityResolutionApplyError";
  }
}

function requireCondition(condition: unknown, code: string, message: string, evidence: JsonRecord = {}): asserts condition {
  if (!condition) throw new ContractorIdentityResolutionApplyError(code, message, evidence);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalized(value: unknown): string {
  return text(value)?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function proposalHash(proposal: ContractorManualIdentityResolutionProposal): string {
  return sha256(stableStringifyContractorIdentityResolution(proposal));
}

function deterministicOperationId(input: ContractorIdentityApplyInput): string {
  return `contractor-identity-${input.contractorId}-${input.expectedBeforeStateFingerprint.slice(0, 16)}-${proposalHash(input.proposal).slice(0, 16)}`;
}

function evidenceHash(evidence: unknown): string {
  return sha256(stableStringifyContractorIdentityResolution(evidence));
}

function assertEvidence(input: ContractorIdentityApplyInput): void {
  const evidence = input.verifiedBusinessIdentityEvidence;
  requireCondition(input.contractorId === ALLOWLISTED_CONTRACTOR_ID, "CONTRACTOR_NOT_ALLOWLISTED", "Only the explicitly allowlisted contractor may be applied.");
  requireCondition(input.proposal.contractorDocumentId === input.contractorId, "PROPOSAL_CONTRACTOR_MISMATCH", "Proposal contractor does not match the requested contractor.");
  requireCondition(evidence.contractorDocumentId === input.contractorId, "EVIDENCE_CONTRACTOR_MISMATCH", "Evidence contractor does not match the requested contractor.");
  requireCondition(evidence.contractorIsolationStatus === "VERIFIED", "EVIDENCE_ISOLATION_REQUIRED", "Evidence contractor isolation is not verified.");
  requireCondition(evidence.verificationStatus === "VERIFIED", "EVIDENCE_VERIFICATION_REQUIRED", "Evidence is not verified.");
  requireCondition(normalized(evidence.legalBusinessName) === normalized("TORQUE EMPIRE (PTY) LTD"), "EVIDENCE_LEGAL_NAME_MISMATCH", "Evidence legal name is not the approved legal identity.");
  requireCondition(normalized(evidence.companyRegistrationNumber) === normalized("2024/105084/07"), "EVIDENCE_REGISTRATION_MISMATCH", "Evidence registration number is not the approved registration.");
  requireCondition(evidence.primarySourceDocumentSHA256 === "170AA775C2F97F2C68D976C098C71E08EA291D3C7E41300592BBDF36FFA787C4", "EVIDENCE_PRIMARY_HASH_MISMATCH", "Primary evidence hash does not match the approved evidence.");
  requireCondition(evidence.supportingSourceDocumentSHA256 === "D35E6EE08179B83F90903DA5BF5F4B48E574462BB18E28FF61AB8370AE1AFC4A", "EVIDENCE_SUPPORTING_HASH_MISMATCH", "Supporting evidence hash does not match the approved evidence.");
  requireCondition(input.proposal.verifiedBusinessIdentityEvidencePath === input.verifiedBusinessIdentityEvidencePath, "EVIDENCE_PATH_MISMATCH", "Proposal evidence path does not match the supplied evidence path.");
}

function assertProposal(input: ContractorIdentityApplyInput): void {
  const proposal = input.proposal;
  requireCondition(proposal.mode === "DRY_RUN_ONLY" && proposal.productionWriteOccurred === false, "PROPOSAL_NOT_DRY_RUN", "Only an approved dry-run proposal may be considered.");
  requireCondition(proposal.resolutionState === "MANUALLY_RESOLVED", "PROPOSAL_STATE_INVALID", "Proposal does not contain the required manual resolution state.");
  requireCondition(proposal.beforeState.canonicalContractorFacingReference.status === "NOT_ISSUED" && proposal.beforeState.canonicalContractorFacingReference.value === null, "REFERENCE_ALREADY_ISSUED", "A contractor-facing reference is already present.");
  requireCondition(proposal.beforeState.identityResolved !== true, "IDENTITY_ALREADY_RESOLVED", "Identity has already been resolved.");
  requireCondition(["CONFLICT", "UNRESOLVED", "MANUAL_REVIEW_REQUIRED", null].includes(proposal.beforeState.identityStatus), "IDENTITY_STATE_NOT_APPLICABLE", "Current identity is not in a conflicted or unresolved state.");
  requireCondition(input.expectedBeforeStateFingerprint === proposal.beforeStateFingerprint, "EXPECTED_FINGERPRINT_PROPOSAL_MISMATCH", "Expected fingerprint does not match the approved proposal.");
  const computed = computeContractorIdentitySourceFingerprint({ contractorId: input.contractorId, snapshot: input.snapshot, auditReport: input.auditReport });
  requireCondition(computed === input.expectedBeforeStateFingerprint, "SOURCE_FINGERPRINT_CHANGED", "Source snapshot/audit fingerprint no longer matches the approved proposal.", { expected: input.expectedBeforeStateFingerprint, computed });
}

export function assertExactIdentityMutationAllowlist(values: Record<string, unknown>): void {
  const paths = Object.keys(values);
  const forbidden = paths.filter((field) => (FORBIDDEN_MUTATION_FIELD_PATHS as readonly string[]).includes(field));
  requireCondition(forbidden.length === 0, "FORBIDDEN_MUTATION_ATTEMPT", "A protected field was included in the identity mutation.", { forbidden });
  const unexpected = paths.filter((field) => !(ALLOWED_IDENTITY_FIELD_PATHS as readonly string[]).includes(field));
  requireCondition(unexpected.length === 0, "IDENTITY_ALLOWLIST_VIOLATION", "Mutation contains a field outside the exact identity allowlist.", { unexpected });
}

function buildIdentityFields(input: ContractorIdentityApplyInput, appliedAt: string | null): Record<string, unknown> {
  const proposal = input.proposal;
  const manualResolution = {
    ...proposal.proposedAfterState.manualResolution,
    appliedAt,
    verifiedBusinessIdentityEvidencePath: input.verifiedBusinessIdentityEvidencePath,
    verifiedBusinessIdentityEvidenceHash: evidenceHash(input.verifiedBusinessIdentityEvidence),
    primarySourceDocumentSHA256: input.verifiedBusinessIdentityEvidence.primarySourceDocumentSHA256,
    supportingSourceDocumentSHA256: input.verifiedBusinessIdentityEvidence.supportingSourceDocumentSHA256,
    beforeStateFingerprint: input.expectedBeforeStateFingerprint,
    rollbackMetadata: {
      operationId: input.operationId ?? deterministicOperationId(input),
      backupRequiredBeforeWrite: true,
      restoreOnlyFields: [...ALLOWED_IDENTITY_FIELD_PATHS],
    },
  };
  const values = {
    legalName: proposal.approvedLegalBusinessName,
    tradingName: proposal.approvedTradingName,
    companyRegistrationNumber: proposal.companyRegistrationNumber,
    identityStatus: "MANUALLY_RESOLVED",
    identityResolved: true,
    identityMatchStatus: "MATCHED_BY_MANUAL_REVIEW",
    manualResolution,
  };
  assertExactIdentityMutationAllowlist(values);
  return values;
}

export function computePostApplyIdentityFingerprint(values: Record<string, unknown>): string {
  const allowed = Object.fromEntries(ALLOWED_IDENTITY_FIELD_PATHS.map((field) => [field, values[field] ?? null]));
  return sha256(stableStringifyContractorIdentityResolution(allowed));
}

export function prepareContractorIdentityResolutionApplyPlan(input: ContractorIdentityApplyInput): ContractorIdentityApplyPlan {
  assertEvidence(input);
  assertProposal(input);
  const operationId = input.operationId ?? deterministicOperationId(input);
  const proposedIdentityFields = buildIdentityFields({ ...input, operationId }, null);
  const proposalSourceHash = proposalHash(input.proposal);
  const evidenceSourceHash = evidenceHash(input.verifiedBusinessIdentityEvidence);
  const postStateFingerprint = computePostApplyIdentityFingerprint(proposedIdentityFields);
  return {
    planType: "CONTRACTOR_IDENTITY_RESOLUTION_APPLY",
    mode: "DRY_RUN_PLAN_ONLY",
    productionExecutionAllowed: false,
    firebaseReadOccurred: false,
    firebaseWriteOccurred: false,
    operationId,
    contractorDocumentPath: `contractors/${input.contractorId}`,
    contractorId: input.contractorId,
    sourcePaths: { proposal: input.proposalPath, snapshot: input.snapshotPath, audit: input.auditPath, verifiedEvidence: input.verifiedBusinessIdentityEvidencePath },
    expectedBeforeStateFingerprint: input.expectedBeforeStateFingerprint,
    computedBeforeStateFingerprint: input.expectedBeforeStateFingerprint,
    beforeState: input.proposal.beforeState,
    proposedIdentityFields: { ...proposedIdentityFields, postStateFingerprint },
    allowedFieldPaths: ALLOWED_IDENTITY_FIELD_PATHS,
    forbiddenFieldPaths: FORBIDDEN_MUTATION_FIELD_PATHS,
    protectedDecisions: { csd: "UNCHANGED_INVALID_OR_UNRESOLVED", readiness: "UNCHANGED", compliance: "UNCHANGED", assignmentAllowed: false, contractorReference: "NOT_ISSUED" },
    backupPlan: { requiredBeforeWrite: true, localRollbackDirectory: "reports/contractors/rollback", liveBackupCreated: false, fieldLevelBeforeValues: [...ALLOWED_IDENTITY_FIELD_PATHS] },
    transactionPlan: { directContractorReadOnly: true, broadCollectionScan: false, revalidateInsideTransaction: true, auditCollection: "auditLogs", identityFieldsOnly: true },
    rollbackPlan: { contractorScoped: true, requiresOperationId: true, requiresBackupSHA256: true, restoresOnlyAllowedIdentityFields: true, refusesUnexpectedPostApplyFingerprint: true },
    auditEventDraft: {
      eventType: "CONTRACTOR_IDENTITY_MANUAL_RESOLUTION_APPLIED",
      operationId,
      contractorId: input.contractorId,
      actor: "Chadwin Wesley Karanie",
      reviewer: input.proposal.reviewerIdentity,
      reviewerRole: input.proposal.reviewerRole,
      appliedLegalIdentity: input.proposal.approvedLegalBusinessName,
      registrationNumber: input.proposal.companyRegistrationNumber,
      proposalPath: input.proposalPath,
      proposalSHA256: proposalSourceHash,
      evidenceArtifactPath: input.verifiedBusinessIdentityEvidencePath,
      evidenceArtifactSHA256: evidenceSourceHash,
      sourcePdfSHA256: { primary: input.verifiedBusinessIdentityEvidence.primarySourceDocumentSHA256, supporting: input.verifiedBusinessIdentityEvidence.supportingSourceDocumentSHA256 },
      beforeStateFingerprint: input.expectedBeforeStateFingerprint,
      postStateFingerprint,
      changedFieldPaths: [...ALLOWED_IDENTITY_FIELD_PATHS],
      unchangedProtectedFieldPaths: [...FORBIDDEN_MUTATION_FIELD_PATHS],
      productionConfirmation: "REQUIRED_AT_APPLY_TIME",
      timestamp: "GENERATED_AT_APPLY_TIME",
      logicVersion: CONTRACTOR_IDENTITY_APPLY_LOGIC_VERSION,
      rollbackBackup: { path: "REQUIRED_BEFORE_WRITE", sha256: "REQUIRED_BEFORE_WRITE" },
      noAssignmentReadinessComplianceReferenceMutation: true,
      dryRunOnly: true,
    },
  };
}

export function resolveSafeApplyReportPath(value: string, cwd = process.cwd(), subdirectory = "reports/contractors"): string {
  const raw = value.trim();
  requireCondition(raw && !raw.includes("\0"), "OUTPUT_PATH_REQUIRED", "A report output path is required.");
  const decoded = decodePath(raw);
  requireCondition(!decoded.replace(/\\/g, "/").split("/").includes(".."), "OUTPUT_PATH_TRAVERSAL", "Report output traversal is not allowed.");
  requireCondition(path.extname(decoded).toLowerCase() === ".json", "OUTPUT_PATH_EXTENSION", "Report output must use .json.");
  const approved = path.resolve(cwd, subdirectory);
  const resolved = path.resolve(cwd, decoded);
  const relative = path.relative(approved, resolved);
  requireCondition(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "OUTPUT_PATH_SCOPE", `Output must remain beneath ${subdirectory}.`);
  return resolved;
}

function decodePath(value: string): string {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    let next: string;
    try { next = decodeURIComponent(current); } catch { break; }
    if (next === current) break;
    current = next;
  }
  return current;
}

export function writeApplyPlanIdempotently(outputPath: string, plan: ContractorIdentityApplyPlan): "created" | "existing_identical" {
  const content = `${stableStringifyContractorIdentityResolution(plan)}\n`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (fs.existsSync(outputPath)) {
    requireCondition(fs.readFileSync(outputPath, "utf8") === content, "OUTPUT_CONFLICT", "Refusing to overwrite a different apply plan.");
    return "existing_identical";
  }
  fs.writeFileSync(outputPath, content, { encoding: "utf8", flag: "wx" });
  return "created";
}

export function createBeforeStateBackup(outputPath: string, input: { contractorId: string; operationId: string; proposalPath: string; expectedFingerprint: string; computedFingerprint: string; beforeState: JsonRecord; appliedAt: string }): { path: string; sha256: string } {
  const backup = { backupType: "CONTRACTOR_IDENTITY_BEFORE_STATE", contractorId: input.contractorId, operationId: input.operationId, timestamp: input.appliedAt, sourceProposalPath: input.proposalPath, expectedBeforeStateFingerprint: input.expectedFingerprint, computedBeforeStateFingerprint: input.computedFingerprint, beforeState: input.beforeState };
  const content = `${stableStringifyContractorIdentityResolution(backup)}\n`;
  requireCondition(!fs.existsSync(outputPath), "BACKUP_ALREADY_EXISTS", "Backup path already exists; refusing overwrite.");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, { encoding: "utf8", flag: "wx" });
  const stored = fs.readFileSync(outputPath, "utf8");
  return { path: outputPath, sha256: sha256(stored) };
}

function currentIdentityFingerprint(current: JsonRecord, approvedBefore: ContractorIdentityResolutionBeforeState): string {
  const candidate = { ...approvedBefore, storedDisplayIdentity: { companyName: text(current.companyName), name: text(current.name), displayName: text(current.displayName) }, verifiedLegalBusinessIdentity: { legalName: text(current.legalName), registeredBusinessName: text(current.registeredBusinessName) ?? text(current.businessName), tradingName: text(current.tradingName) }, contractorDocumentIdentity: { ...approvedBefore.contractorDocumentIdentity, id: text(current.id) ?? approvedBefore.contractorDocumentIdentity.id, contractorId: text(current.contractorId), uid: text(current.uid), authUid: text(current.authUid), userId: text(current.userId), workspaceId: text(current.workspaceId) }, cipcRegistrationEvidence: { ...approvedBefore.cipcRegistrationEvidence, value: text(current.companyRegistrationNumber) ?? text(current.registrationNumber) }, csdSupplierEvidence: { ...approvedBefore.csdSupplierEvidence, value: text(current.csdNumber) ?? text(current.csdMNumber) ?? text(current.mNumber) }, identityStatus: text(current.identityStatus) ?? approvedBefore.identityStatus, identityResolved: current.identityResolved === true ? true : current.identityResolved === false ? false : approvedBefore.identityResolved, identityMatchStatus: text(current.identityMatchStatus) ?? approvedBefore.identityMatchStatus };
  return sha256(stableStringifyContractorIdentityResolution(candidate));
}

export async function applyContractorIdentityResolution(input: ContractorIdentityApplyInput & { db: ApplyFirestore; productionConfirmation: string; allowlistConfirmation: string; reviewerConfirmation: string; rollbackOutputPath: string; auditOutputPath: string; appliedAt?: string }): Promise<{ operationId: string; backup: { path: string; sha256: string }; postStateFingerprint: string; auditEvent: Record<string, unknown> }> {
  requireCondition(input.productionConfirmation === PRODUCTION_CONFIRMATION, "PRODUCTION_CONFIRMATION_INVALID", "The exact production confirmation phrase is required.");
  requireCondition(input.allowlistConfirmation === ALLOWLIST_CONFIRMATION, "ALLOWLIST_CONFIRMATION_INVALID", "The exact allowlist confirmation is required.");
  requireCondition(input.reviewerConfirmation === REVIEWER_CONFIRMATION, "REVIEWER_CONFIRMATION_INVALID", "The exact reviewer confirmation is required.");
  const plan = prepareContractorIdentityResolutionApplyPlan(input);
  const operationId = plan.operationId;
  const ref = input.db.collection("contractors").doc(input.contractorId);
  const live = await ref.get();
  requireCondition(live.exists && live.id === input.contractorId, "LIVE_CONTRACTOR_NOT_FOUND", "The explicitly allowlisted live contractor document was not found.");
  const liveData = live.data() ?? {};
  requireCondition((text(liveData.contractorId) ?? live.id) === input.contractorId, "LIVE_CONTRACTOR_ID_MISMATCH", "Live contractor identity does not match the allowlist.");
  requireCondition(text(liveData.canonicalContractorFacingReference) === null && text(liveData.contractorReference) === null, "LIVE_REFERENCE_ALREADY_ISSUED", "A live contractor-facing reference is already present.");
  requireCondition(liveData.identityResolved !== true, "LIVE_IDENTITY_ALREADY_RESOLVED", "Live contractor identity is already resolved.");
  const liveFingerprint = currentIdentityFingerprint(liveData, plan.beforeState);
  requireCondition(liveFingerprint === input.expectedBeforeStateFingerprint, "LIVE_FINGERPRINT_CHANGED", "Live contractor state differs from the approved before-state fingerprint.", { expected: input.expectedBeforeStateFingerprint, computed: liveFingerprint });
  const appliedAt = input.appliedAt ?? new Date().toISOString();
  const backup = createBeforeStateBackup(input.rollbackOutputPath, { contractorId: input.contractorId, operationId, proposalPath: input.proposalPath, expectedFingerprint: input.expectedBeforeStateFingerprint, computedFingerprint: liveFingerprint, beforeState: liveData, appliedAt });
  const values = buildIdentityFields({ ...input, operationId }, appliedAt);
  const postStateFingerprint = computePostApplyIdentityFingerprint(values);
  const auditEvent = { ...plan.auditEventDraft, dryRunOnly: false, timestamp: appliedAt, rollbackBackup: backup, postStateFingerprint, productionConfirmation: input.productionConfirmation };
  const auditRef = input.db.collection("auditLogs").doc(operationId);
  await input.db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    requireCondition(current.exists && current.id === input.contractorId, "TRANSACTION_CONTRACTOR_NOT_FOUND", "Contractor disappeared before the guarded transaction.");
    const currentData = current.data() ?? {};
    requireCondition(currentIdentityFingerprint(currentData, plan.beforeState) === input.expectedBeforeStateFingerprint, "TRANSACTION_FINGERPRINT_CHANGED", "Contractor changed during the guarded transaction.");
    requireCondition(currentData.identityResolved !== true, "TRANSACTION_IDENTITY_ALREADY_RESOLVED", "Identity was resolved before the transaction completed.");
    requireCondition(!currentData.canonicalContractorFacingReference && !currentData.contractorReference, "TRANSACTION_REFERENCE_ALREADY_ISSUED", "A contractor reference was issued before the transaction completed.");
    assertExactIdentityMutationAllowlist(values);
    transaction.update(ref, values);
    transaction.create(auditRef, auditEvent);
  });
  return { operationId, backup, postStateFingerprint, auditEvent };
}


