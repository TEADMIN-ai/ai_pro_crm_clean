import crypto from "node:crypto";
import {
  cleanContractorIdentityText,
  looksLikePersonalContractorIdentity,
  looksLikePlaceholderContractorIdentity,
} from "@/lib/contractors/contractorBusinessIdentity";
import {
  validateCipcRegistrationNumber,
  validateCsdSupplierNumber,
  type BusinessIdentifierStatus,
} from "@/lib/contractors/contractorRepositoryDecision";
import type {
  ContractorDecisionAuditReport,
  ContractorDecisionAuditSnapshot,
  SnapshotRecord,
} from "@/lib/contractors/contractorDecisionAudit";

export const CONTRACTOR_IDENTITY_RESOLUTION_LOGIC_VERSION = "contractor-identity-resolution-v1";
export const DEFAULT_CONTRACTOR_IDENTITY_RESOLUTION_ALLOWLIST = ["z0yX8cyt38hkfa60UEyNTOiX2812"] as const;

export type ContractorIdentityResolutionState =
  | "UNRESOLVED"
  | "MATCHED"
  | "CONFLICT"
  | "MANUAL_REVIEW_REQUIRED"
  | "MANUALLY_RESOLVED"
  | "REJECTED";

export type ContractorIdentityNamespaceEvidence = {
  authUid: string | null;
  userId: string | null;
  linkedUserId: string | null;
  contractorDocumentId: string;
  workspaceId: string | null;
  cipcRegistrationNumber: string | null;
  csdSupplierNumber: string | null;
  taxpayerNumber: string | null;
  contractorFacingReference: string | null;
};

export type ContractorIdentityResolutionBeforeState = {
  contractorDocumentId: string;
  storedDisplayIdentity: {
    companyName: string | null;
    name: string | null;
    displayName: string | null;
  };
  verifiedLegalBusinessIdentity: {
    legalName: string | null;
    registeredBusinessName: string | null;
    tradingName: string | null;
  };
  cipcRegistrationEvidence: {
    value: string | null;
    status: BusinessIdentifierStatus | string;
  };
  sarsTaxpayerEvidence: {
    taxpayerName: string | null;
    registeredTaxpayerName: string | null;
    verificationStatus: string | null;
  };
  csdSupplierEvidence: {
    value: string | null;
    status: BusinessIdentifierStatus | string;
  };
  userProfileIdentity: {
    userDocumentId: string | null;
    uid: string | null;
    role: string | null;
    name: string | null;
  };
  contractorDocumentIdentity: {
    id: string;
    contractorId: string | null;
    uid: string | null;
    authUid: string | null;
    userId: string | null;
    workspaceId: string | null;
  };
  manualReviewerDecision: null;
  canonicalContractorFacingReference: {
    status: "NOT_ISSUED";
    value: null;
  };
  historicalDecision: {
    readinessScore: unknown;
    readinessStatus: unknown;
    complianceStatus: unknown;
    complianceApproved: unknown;
    logicVersion: unknown;
    authoritative: false;
  };
  identityStatus: ContractorIdentityResolutionState | string | null;
  identityMatchStatus: string | null;
  identityResolved: boolean | null;
};

export type ContractorManualIdentityResolutionInput = {
  contractorId: string;
  allowlist?: readonly string[];
  snapshot: ContractorDecisionAuditSnapshot;
  auditReport: ContractorDecisionAuditReport;
  sourceSnapshotPath: string;
  sourceAuditPath: string;
  approvedLegalBusinessName: string;
  approvedTradingName?: string | null;
  approvedCsdSupplierNumber?: string | null;
  reviewerIdentity: string;
  reviewerRole: string;
  reason: string;
  reviewedAt: string;
  expectedBeforeStateFingerprint: string;
  verifiedBusinessIdentityEvidencePath: string;
  verifiedBusinessIdentityEvidence: { contractorDocumentId: string; contractorIsolationStatus: string; verificationStatus: string; legalBusinessName: string; companyRegistrationNumber: string; primarySourceDocumentSHA256: string; supportingSourceDocumentSHA256: string; controls?: Record<string, unknown> };
  evidenceSourcesReviewed: string[];
  proposedForbiddenAuthorityFields?: Record<string, unknown>;
  proposedCanonicalContractorReference?: string | null;
};

export type ContractorManualIdentityResolutionProposal = {
  proposalType: "CONTRACTOR_MANUAL_IDENTITY_RESOLUTION";
  mode: "DRY_RUN_ONLY";
  productionWriteOccurred: false;
  contractorDocumentId: string;
  resolutionState: ContractorIdentityResolutionState;
  approvedLegalBusinessName: string;
  approvedTradingName: string | null;
  companyRegistrationNumber: string;
  evidenceSourcesReviewed: string[];
  conflictingValues: Record<string, unknown>;
  reviewerIdentity: string;
  reviewerRole: string;
  reason: string;
  reviewedAt: string;
  sourceSnapshotPath: string;
  sourceAuditPath: string;
  verifiedBusinessIdentityEvidencePath: string;
  verifiedBusinessIdentityEvidence: ContractorManualIdentityResolutionInput["verifiedBusinessIdentityEvidence"];
  logicVersion: string;
  beforeStateFingerprint: string;
  beforeState: ContractorIdentityResolutionBeforeState;
  proposedAfterState: {
    identityStatus: "MANUALLY_RESOLVED";
    identityResolved: true;
    identityMatchStatus: "MATCHED_BY_MANUAL_REVIEW";
    legalName: string;
    tradingName: string | null;
    companyRegistrationNumber: string;
    csdNumber: string | null;
    manualResolution: {
      reviewerIdentity: string;
      reviewerRole: string;
      reason: string;
      reviewedAt: string;
      evidenceSourcesReviewed: string[];
      sourceSnapshotPath: string;
      sourceAuditPath: string;
      beforeStateFingerprint: string;
      logicVersion: string;
    };
    canonicalContractorFacingReference: {
      status: "NOT_ISSUED";
      value: null;
    };
    readinessAuthority: "UNCHANGED_NON_AUTHORITATIVE_HISTORICAL_VALUES_NOT_RESTORED";
    complianceAuthority: "UNCHANGED_NON_AUTHORITATIVE_HISTORICAL_VALUES_NOT_RESTORED";
    assignmentAuthority: "UNCHANGED_ASSIGNMENT_REMAINS_BLOCKED_UNTIL_SEPARATE_DECISION";
  };
  rollbackMetadata: {
    rollbackStrategy: "RESTORE_IDENTITY_FIELDS_FROM_BEFORE_STATE_AND_APPEND_REVERSAL_AUDIT_EVENT";
    restoreFields: string[];
    sourceFingerprint: string;
    noProductionMutationInThisProposal: true;
  };
  namespaceSeparation: ContractorIdentityNamespaceEvidence;
  historicalDecisionHandling: {
    readinessScore: unknown;
    readinessStatus: unknown;
    complianceStatus: unknown;
    complianceApproved: unknown;
    logicVersion: unknown;
    authoritative: false;
    action: "REPORT_ONLY_DO_NOT_UPDATE_RESTORE_OR_LEGITIMISE";
  };
  auditEventDraft: {
    eventType: "CONTRACTOR_IDENTITY_MANUAL_RESOLUTION_PREPARED";
    entityType: "contractor";
    entityId: string;
    actorId: string;
    actorRole: string;
    sourceSnapshotPath: string;
    sourceAuditPath: string;
    beforeStateFingerprint: string;
    logicVersion: string;
    dryRunOnly: true;
  };
};

export class ContractorIdentityResolutionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly evidence: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ContractorIdentityResolutionError";
  }
}

type ContractorIdentitySourceInput = {
  contractorId: string;
  allowlist?: readonly string[];
  snapshot: ContractorDecisionAuditSnapshot;
  auditReport: ContractorDecisionAuditReport;
};

function text(value: unknown): string | null {
  return cleanContractorIdentityText(value);
}

function norm(value: unknown): string {
  return text(value)?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])]));
}

export function stableStringifyContractorIdentityResolution(value: unknown): string {
  return JSON.stringify(stable(value), null, 2);
}

export function fingerprintContractorIdentityBeforeState(beforeState: ContractorIdentityResolutionBeforeState): string {
  return crypto.createHash("sha256").update(stableStringifyContractorIdentityResolution(beforeState)).digest("hex");
}

function requireCondition(condition: unknown, code: string, message: string, evidence: Record<string, unknown> = {}): asserts condition {
  if (!condition) throw new ContractorIdentityResolutionError(code, message, evidence);
}

function findContractor(snapshot: ContractorDecisionAuditSnapshot, contractorId: string): SnapshotRecord | null {
  return snapshot.contractors.find((item) => item.id === contractorId || text(item.data.contractorId) === contractorId) ?? null;
}

function findAuditContractor(auditReport: ContractorDecisionAuditReport, contractorId: string) {
  return auditReport.contractors.find((item) => item.contractorId === contractorId) ?? null;
}

function findUser(snapshot: ContractorDecisionAuditSnapshot, contractor: SnapshotRecord): SnapshotRecord | null {
  const candidates = [contractor.data.userId, contractor.data.uid, contractor.data.authUid].map(text).filter((item): item is string => Boolean(item));
  return snapshot.users.find((item) => candidates.includes(item.id) || candidates.includes(text(item.data.uid) ?? "")) ?? null;
}

function sarsRecord(contractor: SnapshotRecord): Record<string, unknown> {
  return record(contractor.data.sarsTcsSummary);
}

function csdValue(contractor: SnapshotRecord): string | null {
  return text(contractor.data.csdNumber) ?? text(contractor.data.csdMNumber) ?? text(contractor.data.mNumber);
}

function cipcValue(contractor: SnapshotRecord): string | null {
  return text(contractor.data.companyRegistrationNumber) ?? text(contractor.data.registrationNumber);
}

function buildBeforeState(input: {
  contractor: SnapshotRecord;
  auditContractor: NonNullable<ReturnType<typeof findAuditContractor>>;
  user: SnapshotRecord | null;
}): ContractorIdentityResolutionBeforeState {
  const sars = sarsRecord(input.contractor);
  const historical = input.auditContractor.historicalDecision ?? {};
  return {
    contractorDocumentId: input.contractor.id,
    storedDisplayIdentity: {
      companyName: text(input.contractor.data.companyName),
      name: text(input.contractor.data.name),
      displayName: text(input.contractor.data.displayName),
    },
    verifiedLegalBusinessIdentity: {
      legalName: text(input.contractor.data.legalName),
      registeredBusinessName: text(input.contractor.data.registeredBusinessName) ?? text(input.contractor.data.businessName),
      tradingName: text(input.contractor.data.tradingName),
    },
    cipcRegistrationEvidence: {
      value: cipcValue(input.contractor),
      status: input.auditContractor.cipcStatus || validateCipcRegistrationNumber(cipcValue(input.contractor)),
    },
    sarsTaxpayerEvidence: {
      taxpayerName: text(input.contractor.data.taxpayerName),
      registeredTaxpayerName: text(sars.registeredTaxpayerName),
      verificationStatus: text(sars.verificationStatus) ?? text(sars.status),
    },
    csdSupplierEvidence: {
      value: csdValue(input.contractor),
      status: input.auditContractor.csdStatus || validateCsdSupplierNumber(csdValue(input.contractor)),
    },
    userProfileIdentity: {
      userDocumentId: input.user?.id ?? null,
      uid: text(input.user?.data.uid),
      role: text(input.user?.data.role),
      name: text(input.user?.data.name) ?? text(input.user?.data.displayName),
    },
    contractorDocumentIdentity: {
      id: input.contractor.id,
      contractorId: text(input.contractor.data.contractorId),
      uid: text(input.contractor.data.uid),
      authUid: text(input.contractor.data.authUid),
      userId: text(input.contractor.data.userId),
      workspaceId: text(input.contractor.data.workspaceId),
    },
    manualReviewerDecision: null,
    canonicalContractorFacingReference: {
      status: "NOT_ISSUED",
      value: null,
    },
    historicalDecision: {
      readinessScore: historical.readinessScore ?? null,
      readinessStatus: historical.readinessStatus ?? null,
      complianceStatus: historical.complianceStatus ?? null,
      complianceApproved: historical.complianceApproved ?? null,
      logicVersion: historical.logicVersion ?? null,
      authoritative: false,
    },
    identityStatus: input.auditContractor.identityStatus,
    identityMatchStatus: input.auditContractor.identityMatchStatus,
    identityResolved: input.auditContractor.identityResolved,
  };
}

function buildNamespace(beforeState: ContractorIdentityResolutionBeforeState): ContractorIdentityNamespaceEvidence {
  return {
    authUid: beforeState.contractorDocumentIdentity.authUid,
    userId: beforeState.contractorDocumentIdentity.userId,
    linkedUserId: beforeState.userProfileIdentity.userDocumentId,
    contractorDocumentId: beforeState.contractorDocumentIdentity.id,
    workspaceId: beforeState.contractorDocumentIdentity.workspaceId,
    cipcRegistrationNumber: beforeState.cipcRegistrationEvidence.value,
    csdSupplierNumber: beforeState.csdSupplierEvidence.value,
    taxpayerNumber: null,
    contractorFacingReference: null,
  };
}

function buildRequiredBeforeState(input: ContractorIdentitySourceInput): ContractorIdentityResolutionBeforeState {
  const contractorId = text(input.contractorId);
  requireCondition(contractorId, "MISSING_CONTRACTOR_ID", "An explicit contractor ID is required.");
  const allowlist = input.allowlist ?? DEFAULT_CONTRACTOR_IDENTITY_RESOLUTION_ALLOWLIST;
  requireCondition(allowlist.includes(contractorId), "CONTRACTOR_NOT_ALLOWLISTED", "Contractor is not explicitly allowlisted for manual identity resolution.", { contractorId, allowlist });
  const contractor = findContractor(input.snapshot, contractorId);
  requireCondition(contractor, "CONTRACTOR_SNAPSHOT_NOT_FOUND", "Contractor snapshot cannot be found.", { contractorId });
  const auditContractor = findAuditContractor(input.auditReport, contractorId);
  requireCondition(auditContractor, "CONTRACTOR_AUDIT_NOT_FOUND", "Contractor audit entry cannot be found.", { contractorId });
  return buildBeforeState({ contractor, auditContractor, user: findUser(input.snapshot, contractor) });
}

export function computeContractorIdentitySourceFingerprint(input: ContractorIdentitySourceInput): string {
  return fingerprintContractorIdentityBeforeState(buildRequiredBeforeState(input));
}

function assertNoNamespaceReuse(value: string, namespace: ContractorIdentityNamespaceEvidence, field: string): void {
  const candidate = norm(value);
  const collisions = Object.entries(namespace).filter(([, unsafe]) => unsafe && norm(unsafe) === candidate).map(([key]) => key);
  requireCondition(collisions.length === 0, "NAMESPACE_REUSE_BLOCKED", `${field} must not reuse a technical, registration, supplier, taxpayer, workspace, or contractor-facing reference namespace.`, { field, collisions });
}

function assertNoForbiddenAuthorityFields(fields: Record<string, unknown> | undefined): void {
  const proposed = fields ?? {};
  const forbiddenGroups: Array<{ code: string; fields: string[]; message: string }> = [
    { code: "CONTRACTOR_REFERENCE_ISSUANCE_BLOCKED", fields: ["teosContractorReference", "contractorReference", "contractorNumber", "businessReference", "canonicalContractorReference"], message: "This slice must not issue a canonical contractor-facing reference." },
    { code: "READINESS_AUTHORITY_UPDATE_BLOCKED", fields: ["readinessScore", "readinessStatus", "readinessDecisionStatus", "tenderLockStatus"], message: "This slice must not set readiness authority." },
    { code: "COMPLIANCE_AUTHORITY_UPDATE_BLOCKED", fields: ["complianceStatus", "complianceApproved", "complianceScore", "complianceDecisionStatus"], message: "This slice must not set compliance authority." },
    { code: "ASSIGNMENT_AUTHORITY_UPDATE_BLOCKED", fields: ["assignmentAllowed", "assignmentStatus", "assignedContractorId"], message: "This slice must not set assignment authority." },
  ];
  for (const group of forbiddenGroups) {
    const present = group.fields.filter((field) => proposed[field] !== undefined);
    requireCondition(present.length === 0, group.code, group.message, { fields: present });
  }
}

export function prepareContractorManualIdentityResolutionProposal(input: ContractorManualIdentityResolutionInput): ContractorManualIdentityResolutionProposal {
  const contractorId = text(input.contractorId);
  requireCondition(contractorId, "MISSING_CONTRACTOR_ID", "An explicit contractor ID is required.");
  const allowlist = input.allowlist ?? DEFAULT_CONTRACTOR_IDENTITY_RESOLUTION_ALLOWLIST;
  requireCondition(allowlist.includes(contractorId), "CONTRACTOR_NOT_ALLOWLISTED", "Contractor is not explicitly allowlisted for manual identity resolution.", { contractorId, allowlist });
  const expectedBeforeStateFingerprint = text(input.expectedBeforeStateFingerprint);
  requireCondition(expectedBeforeStateFingerprint, "EXPECTED_FINGERPRINT_REQUIRED", "Expected before-state fingerprint is required for manual production-derived identity resolution.");
  const verifiedEvidence = input.verifiedBusinessIdentityEvidence;
  requireCondition(text(input.verifiedBusinessIdentityEvidencePath), "VERIFIED_EVIDENCE_PATH_REQUIRED", "Verified business-identity evidence artifact path is required.");
  requireCondition(verifiedEvidence, "VERIFIED_EVIDENCE_REQUIRED", "Verified business-identity evidence artifact is required.");
  requireCondition(verifiedEvidence.contractorDocumentId === contractorId, "VERIFIED_EVIDENCE_CONTRACTOR_MISMATCH", "Verified evidence contractor ID does not match the allowlisted contractor.");
  requireCondition(verifiedEvidence.contractorIsolationStatus === "VERIFIED", "VERIFIED_EVIDENCE_ISOLATION_REQUIRED", "Verified evidence contractor isolation is not verified.");
  requireCondition(verifiedEvidence.verificationStatus === "VERIFIED", "VERIFIED_EVIDENCE_STATUS_REQUIRED", "Verified evidence status is not VERIFIED.");
  requireCondition(norm(verifiedEvidence.legalBusinessName) === norm("TORQUE EMPIRE (PTY) LTD"), "VERIFIED_EVIDENCE_LEGAL_NAME_MISMATCH", "Verified evidence legal name does not match the approved legal identity.");
  requireCondition(norm(verifiedEvidence.companyRegistrationNumber) === norm("2024/105084/07"), "VERIFIED_EVIDENCE_REGISTRATION_MISMATCH", "Verified evidence registration number does not match the contractor CIPC registration.");
  requireCondition(verifiedEvidence.primarySourceDocumentSHA256 === "170AA775C2F97F2C68D976C098C71E08EA291D3C7E41300592BBDF36FFA787C4", "VERIFIED_EVIDENCE_PRIMARY_HASH_MISMATCH", "Verified evidence primary source hash is not the confirmed hash.");
  requireCondition(verifiedEvidence.supportingSourceDocumentSHA256 === "D35E6EE08179B83F90903DA5BF5F4B48E574462BB18E28FF61AB8370AE1AFC4A", "VERIFIED_EVIDENCE_SUPPORTING_HASH_MISMATCH", "Verified evidence supporting source hash is not the confirmed hash.");
  requireCondition(!input.proposedCanonicalContractorReference, "CONTRACTOR_REFERENCE_ISSUANCE_BLOCKED", "This slice must not issue a canonical contractor-facing reference.");
  assertNoForbiddenAuthorityFields(input.proposedForbiddenAuthorityFields);

  const contractor = findContractor(input.snapshot, contractorId);
  requireCondition(contractor, "CONTRACTOR_SNAPSHOT_NOT_FOUND", "Contractor snapshot cannot be found.", { contractorId });
  const auditContractor = findAuditContractor(input.auditReport, contractorId);
  requireCondition(auditContractor, "CONTRACTOR_AUDIT_NOT_FOUND", "Contractor audit entry cannot be found.", { contractorId });
  const user = findUser(input.snapshot, contractor);
  const beforeState = buildBeforeState({ contractor, auditContractor, user });
  const beforeStateFingerprint = fingerprintContractorIdentityBeforeState(beforeState);
  requireCondition(expectedBeforeStateFingerprint === beforeStateFingerprint, "SOURCE_FINGERPRINT_CHANGED", "Source contractor state has changed since the reviewed snapshot fingerprint.", { expected: expectedBeforeStateFingerprint, actual: beforeStateFingerprint });

  requireCondition(beforeState.cipcRegistrationEvidence.status === "VALID", "CIPC_INVALID_OR_MISSING", "CIPC evidence is missing or invalid.", beforeState.cipcRegistrationEvidence);
  const approvedLegalBusinessName = text(input.approvedLegalBusinessName);
  requireCondition(approvedLegalBusinessName, "APPROVED_LEGAL_NAME_REQUIRED", "Approved legal business name is required.");
  requireCondition(!looksLikePlaceholderContractorIdentity(approvedLegalBusinessName), "APPROVED_LEGAL_NAME_INVALID", "Approved legal business name must not be a placeholder.", { approvedLegalBusinessName });
  const reviewerIdentity = text(input.reviewerIdentity);
  const reviewerRole = text(input.reviewerRole);
  const reason = text(input.reason);
  requireCondition(reviewerIdentity && reviewerRole, "REVIEWER_REQUIRED", "Reviewer identity and role are required.");
  requireCondition(reason, "REASON_REQUIRED", "Manual resolution reason is required.");

  const approvedTradingName = text(input.approvedTradingName);
  const proposedCsd = text(input.approvedCsdSupplierNumber);
  if (proposedCsd) {
    requireCondition(validateCsdSupplierNumber(proposedCsd) === "VALID", "CSD_INVALID", "Supplied CSD supplier number is invalid.", { approvedCsdSupplierNumber: proposedCsd });
  }

  const namespace = buildNamespace(beforeState);
  assertNoNamespaceReuse(approvedLegalBusinessName, namespace, "approvedLegalBusinessName");
  if (approvedTradingName) assertNoNamespaceReuse(approvedTradingName, namespace, "approvedTradingName");
  requireCondition(norm(approvedLegalBusinessName) === norm(verifiedEvidence.legalBusinessName), "APPROVED_LEGAL_NAME_EVIDENCE_MISMATCH", "Approved legal business name must match verified evidence.");

  const storedDisplayValues = Object.values(beforeState.storedDisplayIdentity).filter((value): value is string => Boolean(value));
  const matchesPersonalDisplay = storedDisplayValues.some((value) => norm(value) === norm(approvedLegalBusinessName) && looksLikePersonalContractorIdentity(value));
  const supportingBusinessNameEvidence = [
    beforeState.sarsTaxpayerEvidence.taxpayerName,
    beforeState.sarsTaxpayerEvidence.registeredTaxpayerName,
    beforeState.verifiedLegalBusinessIdentity.legalName,
    beforeState.verifiedLegalBusinessIdentity.registeredBusinessName,
  ].some((value) => value && norm(value) === norm(approvedLegalBusinessName));
  requireCondition(!matchesPersonalDisplay || supportingBusinessNameEvidence, "PERSONAL_DISPLAY_IDENTITY_REJECTED", "Approved legal identity equals a personal profile/display identity without supporting business evidence.", { approvedLegalBusinessName, storedDisplayValues });

  const companyRegistrationNumber = beforeState.cipcRegistrationEvidence.value;
  requireCondition(companyRegistrationNumber, "CIPC_INVALID_OR_MISSING", "CIPC registration number is required for manual identity resolution.");
  const evidenceSourcesReviewed = Array.from(new Set(input.evidenceSourcesReviewed.map(text).filter((item): item is string => Boolean(item)))).sort();
  requireCondition(evidenceSourcesReviewed.length > 0, "EVIDENCE_SOURCES_REQUIRED", "At least one evidence source reviewed is required.");

  const conflictingValues = {
    storedDisplayIdentity: beforeState.storedDisplayIdentity,
    sarsTaxpayerEvidence: beforeState.sarsTaxpayerEvidence,
    csdSupplierEvidence: beforeState.csdSupplierEvidence,
    identityStatus: beforeState.identityStatus,
    identityMatchStatus: beforeState.identityMatchStatus,
    identityResolved: beforeState.identityResolved,
    historicalDecision: beforeState.historicalDecision,
  };

  return {
    proposalType: "CONTRACTOR_MANUAL_IDENTITY_RESOLUTION",
    mode: "DRY_RUN_ONLY",
    productionWriteOccurred: false,
    contractorDocumentId: contractor.id,
    resolutionState: "MANUALLY_RESOLVED",
    approvedLegalBusinessName,
    approvedTradingName: approvedTradingName ?? null,
    companyRegistrationNumber,
    evidenceSourcesReviewed,
    conflictingValues,
    reviewerIdentity,
    reviewerRole,
    reason,
    reviewedAt: input.reviewedAt,
    sourceSnapshotPath: input.sourceSnapshotPath,
    sourceAuditPath: input.sourceAuditPath,
    verifiedBusinessIdentityEvidencePath: input.verifiedBusinessIdentityEvidencePath,
    verifiedBusinessIdentityEvidence: verifiedEvidence,
    logicVersion: CONTRACTOR_IDENTITY_RESOLUTION_LOGIC_VERSION,
    beforeStateFingerprint,
    beforeState,
    proposedAfterState: {
      identityStatus: "MANUALLY_RESOLVED",
      identityResolved: true,
      identityMatchStatus: "MATCHED_BY_MANUAL_REVIEW",
      legalName: approvedLegalBusinessName,
      tradingName: approvedTradingName ?? null,
      companyRegistrationNumber,
      csdNumber: proposedCsd ?? null,
      manualResolution: {
        reviewerIdentity,
        reviewerRole,
        reason,
        reviewedAt: input.reviewedAt,
        evidenceSourcesReviewed,
        sourceSnapshotPath: input.sourceSnapshotPath,
        sourceAuditPath: input.sourceAuditPath,
        beforeStateFingerprint,
        logicVersion: CONTRACTOR_IDENTITY_RESOLUTION_LOGIC_VERSION,
      },
      canonicalContractorFacingReference: {
        status: "NOT_ISSUED",
        value: null,
      },
      readinessAuthority: "UNCHANGED_NON_AUTHORITATIVE_HISTORICAL_VALUES_NOT_RESTORED",
      complianceAuthority: "UNCHANGED_NON_AUTHORITATIVE_HISTORICAL_VALUES_NOT_RESTORED",
      assignmentAuthority: "UNCHANGED_ASSIGNMENT_REMAINS_BLOCKED_UNTIL_SEPARATE_DECISION",
    },
    rollbackMetadata: {
      rollbackStrategy: "RESTORE_IDENTITY_FIELDS_FROM_BEFORE_STATE_AND_APPEND_REVERSAL_AUDIT_EVENT",
      restoreFields: ["legalName", "tradingName", "identityStatus", "identityResolved", "identityMatchStatus", "manualResolution"],
      sourceFingerprint: beforeStateFingerprint,
      noProductionMutationInThisProposal: true,
    },
    namespaceSeparation: namespace,
    historicalDecisionHandling: {
      readinessScore: beforeState.historicalDecision.readinessScore,
      readinessStatus: beforeState.historicalDecision.readinessStatus,
      complianceStatus: beforeState.historicalDecision.complianceStatus,
      complianceApproved: beforeState.historicalDecision.complianceApproved,
      logicVersion: beforeState.historicalDecision.logicVersion,
      authoritative: false,
      action: "REPORT_ONLY_DO_NOT_UPDATE_RESTORE_OR_LEGITIMISE",
    },
    auditEventDraft: {
      eventType: "CONTRACTOR_IDENTITY_MANUAL_RESOLUTION_PREPARED",
      entityType: "contractor",
      entityId: contractor.id,
      actorId: reviewerIdentity,
      actorRole: reviewerRole,
      sourceSnapshotPath: input.sourceSnapshotPath,
      sourceAuditPath: input.sourceAuditPath,
      beforeStateFingerprint,
      logicVersion: CONTRACTOR_IDENTITY_RESOLUTION_LOGIC_VERSION,
      dryRunOnly: true,
    },
  };
}
