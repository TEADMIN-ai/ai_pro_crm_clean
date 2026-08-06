import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { buildContractorSelectorOption } from "@/lib/contractors/contractorSelectorOptions";
import {
  CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION,
  buildContractorRepositoryDecision,
  validateCsdSupplierNumber,
} from "@/lib/contractors/contractorRepositoryDecision";
import { resolveContractorBusinessIdentity } from "@/lib/contractors/contractorBusinessIdentity";
import {
  SUPPORTED_DOCUMENT_TYPES,
  getDocumentTypeLabel,
  normalizeContractorUploadDocumentType,
  normalizeSupportedDocumentType,
  resolveContractorDocumentStatus,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import {
  buildOpportunityExecutionState,
  evaluateOpportunityCompliance,
  extractOpportunityRequirements,
  matchContractorsForOpportunity,
} from "@/lib/opportunities/opportunityExecution";
import { buildSarsTcsProjection, type SarsTcsVerificationRecord } from "@/lib/sars-tcs";
import type { ContractorDocument } from "@/types/document";

type AnyRecord = Record<string, unknown>;

export type DiagnosticAuthorityStatus = "ALLOWED" | "BLOCKED";

export type DiagnosticInput = {
  contractorId: string;
  dealId: string;
  workspaceId?: string | null;
  actorUid?: string | null;
  productionReadOnlyConfirmation?: string | null;
  production?: boolean;
  evaluatedAt?: string;
};

export type DiagnosticDocumentSnapshot = {
  exists: boolean;
  id: string;
  path: string;
  data: AnyRecord | null;
};

export type DiagnosticReader = {
  getDocument(path: string): Promise<DiagnosticDocumentSnapshot>;
  listSubcollection(path: string): Promise<DiagnosticDocumentSnapshot[]>;
};

export type AssignmentDiagnosticReport = {
  input: {
    contractorId: string;
    dealId: string;
    workspaceId: string | null;
    actorUid: string | null;
    evaluatedAt: string;
  };
  readPaths: string[];
  contractorIdentity: {
    requestedContractorId: string;
    resolvedCanonicalContractorId: string | null;
    businessName: string | null;
    identityResolved: boolean;
    identityStatus: string;
    ambiguityOrDuplicateLinkage: string[];
    archived: boolean;
    status: string | null;
  };
  workspace: {
    contractorWorkspaceId: string | null;
    dealWorkspaceId: string | null;
    expectedWorkspaceId: string | null;
    matches: boolean;
    unresolvedWorkspacePaths: string[];
  };
  repositoryReadiness: {
    readinessDecisionStatus: string;
    assignmentAllowed: boolean;
    decisionLogicVersion: string;
    expectedLogicVersion: string;
    stale: boolean;
    staleReasons: string[];
    blockers: string[];
    warnings: string[];
  };
  requiredEvidence: Array<{
    requiredKey: SupportedDocumentType;
    label: string;
    found: boolean;
    sourcePath: string | null;
    verificationStatus: string;
    issueOrExpiryDate: string | null;
    currency: "current" | "expired" | "unknown";
    includedInReadinessComputation: boolean;
  }>;
  csdAndSars: {
    supplierNumber: string | null;
    csdEvidenceStatus: string;
    sarsTcsStatus: string;
    supportingEvidencePath: string | null;
    currency: "current" | "expired" | "unknown";
    blockers: string[];
  };
  opportunitySpecificAssignmentDecision: {
    dealPhase: string;
    phaseIsMatchingRequired: boolean;
    appearsInBoundedExecutionMatches: boolean;
    uiAssignmentAllowedDecision: boolean;
    serverCurrentCodeComplianceStatus: string;
    serverCurrentCodeBlockers: string[];
    canonicalEvidenceComplianceStatus: string;
    canonicalEvidenceBlockers: string[];
    uiServerDisagreement: boolean;
  };
  assignmentAuthorityPreview: {
    status: DiagnosticAuthorityStatus;
    blockers: string[];
    warnings: string[];
    noWriteRecommendation: string;
    recommendedRepairCategory: string;
  };
  dataShapeIssues: {
    listContractorsOmitsDocumentEvidenceNeededByOpportunityMatching: boolean;
    selectorDataDiffersFromCanonicalRepositoryDecisionInputs: boolean;
    embeddedLegacyFlagsTrustedInsteadOfCurrentDocumentEvidence: boolean;
    repositoryReadyDiffersFromOpportunityAssignmentReadiness: boolean;
    details: string[];
  };
};

export const PRODUCTION_READ_ONLY_CONFIRMATION = "READ_ONLY_PRODUCTION_DIAGNOSTIC";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function record(value: unknown): AnyRecord {
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

function isoDate(value: unknown): string | null {
  const millis = toMillis(value);
  return millis === null ? null : new Date(millis).toISOString();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function canonicalContractorId(contractor: AnyRecord & { id: string }): string | null {
  return text(contractor.contractorId) ?? contractor.id;
}

function contractorWorkspaceId(contractor: AnyRecord): string | null {
  const workspace = record(contractor.workspace);
  return text(contractor.workspaceId) ?? text(workspace.id);
}

function businessName(contractor: AnyRecord): string | null {
  const identity = resolveContractorBusinessIdentity(contractor);
  return identity.label ?? text(contractor.companyName) ?? text(contractor.businessName) ?? text(contractor.name);
}

function isArchived(contractor: AnyRecord): boolean {
  return bool(contractor.archived) || text(contractor.status)?.toLowerCase() === "archived";
}

function normalizeDocument(path: string, snapshot: DiagnosticDocumentSnapshot, contractorId: string): ContractorDocument {
  const data = snapshot.data ?? {};
  return {
    id: snapshot.id,
    contractorId: text(data.contractorId) ?? contractorId,
    documentType: text(data.documentType) ?? text(data.docType) ?? text(data.complianceType),
    docType: text(data.docType),
    fileName: text(data.fileName),
    originalName: text(data.originalName),
    filename: text(data.filename),
    documentName: text(data.documentName),
    storagePath: text(data.storagePath),
    fileUrl: text(data.fileUrl) ?? text(data.downloadURL) ?? text(data.url),
    downloadURL: text(data.downloadURL) ?? text(data.fileUrl),
    verified: data.verified === true || toMillis(data.verifiedAt) !== null,
    verifiedAt: toMillis(data.verifiedAt) ?? undefined,
    validationError: text(data.validationError),
    validationStatus: data.validationStatus === "PASS" || data.validationStatus === "REVIEW" || data.validationStatus === "FAIL" ? data.validationStatus : undefined,
    verificationStatus: text(data.verificationStatus) ?? undefined,
    status: text(data.status) ?? undefined,
    expiresAt: toMillis(data.expiresAt ?? data.expiryDate) ?? undefined,
    expiryDate: toMillis(data.expiryDate) ?? undefined,
    isExpired: data.isExpired === true,
    uploadedAt: toMillis(data.uploadedAt) ?? undefined,
    createdAt: toMillis(data.createdAt) ?? undefined,
    updatedAt: toMillis(data.updatedAt) ?? undefined,
    extractedAt: toMillis(data.extractedAt) ?? undefined,
  };
}

function documentPath(contractorId: string, document: ContractorDocument): string {
  return `contractors/${contractorId}/documents/${document.id}`;
}

function pickRequirementDocument(contractorId: string, documents: ContractorDocument[], key: SupportedDocumentType) {
  const candidates = documents.filter((document) => normalizeSupportedDocumentType(document.documentType ?? document.docType ?? document.id) === key);
  const statusOrder = ["verified", "expiringSoon", "uploaded", "invalid", "expired", "missing"];
  const sorted = candidates.sort((left, right) => {
    const leftStatus = resolveContractorDocumentStatus(left);
    const rightStatus = resolveContractorDocumentStatus(right);
    return statusOrder.indexOf(leftStatus) - statusOrder.indexOf(rightStatus);
  });
  const document = sorted[0] ?? null;
  if (!document) {
    return {
      requiredKey: key,
      label: getDocumentTypeLabel(key),
      found: false,
      sourcePath: null,
      verificationStatus: "missing",
      issueOrExpiryDate: null,
      currency: "unknown" as const,
      includedInReadinessComputation: false,
    };
  }
  const status = resolveContractorDocumentStatus(document);
  return {
    requiredKey: key,
    label: getDocumentTypeLabel(key),
    found: true,
    sourcePath: documentPath(contractorId, document),
    verificationStatus: document.verificationStatus ?? status,
    issueOrExpiryDate: isoDate(document.expiresAt ?? document.expiryDate),
    currency: status === "expired" ? "expired" as const : status === "verified" || status === "expiringSoon" ? "current" as const : "unknown" as const,
    includedInReadinessComputation: status === "verified" || status === "expiringSoon",
  };
}

function findCsdDocument(contractorId: string, documents: ContractorDocument[]) {
  const doc = documents.find((document) => normalizeContractorUploadDocumentType(document.documentType ?? document.docType ?? document.id) === "csd");
  return doc ? { path: documentPath(contractorId, doc), status: resolveContractorDocumentStatus(doc) } : null;
}

function sarsRecordFrom(contractor: AnyRecord, sarsDocs: DiagnosticDocumentSnapshot[]): SarsTcsVerificationRecord | null {
  const summary = record(contractor.sarsTcsSummary);
  if (Object.keys(summary).length) return summary as SarsTcsVerificationRecord;
  const first = sarsDocs.find((doc) => doc.exists && doc.data)?.data;
  return first ? first as SarsTcsVerificationRecord : null;
}

function linkageIssues(contractor: AnyRecord & { id: string }, requestedId: string): string[] {
  const ids = [contractor.id, contractor.contractorId, contractor.uid, contractor.authUid, contractor.userId, contractor.linkedUserId]
    .map(text)
    .filter((value): value is string => Boolean(value));
  const uniqueIds = unique(ids);
  const issues: string[] = [];
  if (!uniqueIds.includes(requestedId)) issues.push("Requested ID is not present in canonical linkage fields");
  if (uniqueIds.length > 1) issues.push(`Multiple linkage identifiers observed: ${uniqueIds.join(", ")}`);
  return issues;
}

function recommendedRepairCategory(blockers: string[]): string {
  const joined = blockers.join(" | ").toLowerCase();
  if (joined.includes("identity")) return "IDENTITY_RESOLUTION";
  if (joined.includes("workspace")) return "WORKSPACE_LINKAGE";
  if (joined.includes("archived")) return "ARCHIVE_STATUS_REVIEW";
  if (joined.includes("sars") || joined.includes("csd")) return "EXTERNAL_EVIDENCE";
  if (joined.includes("document") || joined.includes("compliance")) return "DOCUMENT_EVIDENCE";
  if (joined.includes("phase")) return "DEAL_PHASE";
  return blockers.length ? "DECISION_REVIEW" : "NONE";
}

export async function buildContractorAssignmentDiagnostic(
  input: DiagnosticInput,
  reader: DiagnosticReader,
): Promise<AssignmentDiagnosticReport> {
  if (input.production && input.productionReadOnlyConfirmation !== PRODUCTION_READ_ONLY_CONFIRMATION) {
    throw new Error(`Production diagnostic requires ${PRODUCTION_READ_ONLY_CONFIRMATION}`);
  }

  const readPaths: string[] = [];
  const readDoc = async (path: string) => {
    readPaths.push(path);
    return reader.getDocument(path);
  };
  const readCollection = async (path: string) => {
    readPaths.push(`${path}/*`);
    return reader.listSubcollection(path);
  };

  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const [actorSnapshot, dealSnapshot, contractorSnapshot, documentSnapshots, sarsSnapshots, executionWorkspace, submissionReview] = await Promise.all([
    input.actorUid ? readDoc(`users/${input.actorUid}`) : Promise.resolve(null),
    readDoc(`deals/${input.dealId}`),
    readDoc(`contractors/${input.contractorId}`),
    readCollection(`contractors/${input.contractorId}/documents`),
    readCollection(`contractors/${input.contractorId}/sarsTcs`),
    readDoc(`opportunityExecutionWorkspaces/${input.dealId}`),
    readDoc(`submissionReviews/${input.dealId}`),
  ]);

  void actorSnapshot;
  void executionWorkspace;
  void submissionReview;

  if (!dealSnapshot.exists || !dealSnapshot.data) throw new Error(`Deal not found: ${input.dealId}`);
  if (!contractorSnapshot.exists || !contractorSnapshot.data) throw new Error(`Contractor not found: ${input.contractorId}`);

  const deal: AnyRecord & { id: string } = { id: dealSnapshot.id, ...dealSnapshot.data };
  const contractor: AnyRecord & { id: string } = { id: contractorSnapshot.id, ...contractorSnapshot.data };
  const canonicalId = canonicalContractorId(contractor);
  const documents = documentSnapshots.filter((snapshot) => snapshot.exists && snapshot.data).map((snapshot) => normalizeDocument(snapshot.path, snapshot, canonicalId ?? input.contractorId));
  const identity = resolveContractorBusinessIdentity(contractor);
  const repositoryDecision = buildContractorRepositoryDecision({ contractor, documents, evaluatedAt });
  const dealWorkspaceId = text(deal.workspaceId);
  const contractorWs = contractorWorkspaceId(contractor);
  const expectedWorkspaceId = text(input.workspaceId);
  const workspaceBlockers = [
    ...(!dealWorkspaceId ? ["Deal workspace is unresolved"] : []),
    ...(!contractorWs ? ["Contractor workspace is unresolved"] : []),
    ...(expectedWorkspaceId && dealWorkspaceId && expectedWorkspaceId !== dealWorkspaceId ? ["Deal workspace does not match expected workspace"] : []),
    ...(dealWorkspaceId && contractorWs && dealWorkspaceId !== contractorWs ? ["Contractor workspace does not match deal workspace"] : []),
  ];

  const requiredEvidence = SUPPORTED_DOCUMENT_TYPES.map((key) => pickRequirementDocument(canonicalId ?? input.contractorId, documents, key));
  const csdNumber = text(contractor.csdNumber) ?? text(contractor.csdMNumber) ?? text(contractor.mNumber);
  const csdDoc = findCsdDocument(canonicalId ?? input.contractorId, documents);
  const csdStatus = validateCsdSupplierNumber(csdNumber);
  const sarsRecord = sarsRecordFrom(contractor, sarsSnapshots);
  const sarsProjection = buildSarsTcsProjection({
    record: sarsRecord,
    taxDocumentStatus: requiredEvidence.find((item) => item.requiredKey === "taxClearance")?.verificationStatus ?? "unknown",
    requiresLiveVerification: true,
    now: new Date(evaluatedAt),
  });

  const requirements = extractOpportunityRequirements(deal);
  const stateWithoutContractorDocuments = buildOpportunityExecutionState({ deal, contractor });
  const rawMatch = matchContractorsForOpportunity({ deal, contractors: [contractor] })[0] ?? null;
  const contractorWithCurrentDocuments = { ...contractor, documents };
  const complianceCurrentCode = evaluateOpportunityCompliance(requirements, contractor, dealWorkspaceId);
  const complianceCanonicalEvidence = evaluateOpportunityCompliance(requirements, contractorWithCurrentDocuments, dealWorkspaceId);
  const boundedMatchWithCurrentEvidence = matchContractorsForOpportunity({ deal, contractors: [contractorWithCurrentDocuments] })[0] ?? null;
  const phaseIsMatchingRequired = stateWithoutContractorDocuments.currentPhase === "MATCHING_REQUIRED";
  const uiAllowed = Boolean(rawMatch?.assignmentAllowed);

  const authorityBlockers = unique([
    ...repositoryDecision.blockingReasons,
    ...workspaceBlockers,
    ...(isArchived(contractor) ? ["Contractor is archived and cannot receive new assignments."] : []),
    ...(identity.identityResolved ? [] : ["Contractor identity is unresolved"]),
    ...(repositoryDecision.assignmentAllowed ? [] : ["Canonical repository assignment authority is not ALLOWED"]),
    ...(phaseIsMatchingRequired ? [] : [`Deal phase is ${stateWithoutContractorDocuments.currentPhase}, not MATCHING_REQUIRED`]),
    ...(complianceCanonicalEvidence.status === "VALID" ? [] : [...complianceCanonicalEvidence.missing, ...complianceCanonicalEvidence.expired.map((item) => `${item} expired`)]),
  ]);
  const warnings = unique([
    ...repositoryDecision.warnings,
    ...(uiAllowed && authorityBlockers.length ? ["UI/current match calculation allows assignment while authority preview blocks it"] : []),
    ...(complianceCurrentCode.status !== complianceCanonicalEvidence.status ? ["Current server matching evidence shape differs from canonical document evidence"] : []),
  ]);

  const dataShapeDetails: string[] = [];
  const hasSubcollectionEvidence = documents.length > 0;
  const hasEmbeddedEvidence = Array.isArray(contractor.documents) || Array.isArray(contractor.contractorDocuments);
  if (hasSubcollectionEvidence && !hasEmbeddedEvidence) dataShapeDetails.push("Current contractor record has document subcollection evidence but no embedded document array for opportunity matching.");
  if (buildContractorSelectorOption(contractor)) dataShapeDetails.push("Selector option is identity/workspace/name only and does not carry document or SARS evidence.");
  if (rawMatch?.assignmentAllowed !== boundedMatchWithCurrentEvidence?.assignmentAllowed) dataShapeDetails.push("Opportunity matching result changes when current document subcollection evidence is embedded.");
  if (repositoryDecision.assignmentAllowed !== Boolean(boundedMatchWithCurrentEvidence?.assignmentAllowed)) dataShapeDetails.push("Repository assignment authority differs from opportunity matching readiness.");

  return {
    input: {
      contractorId: input.contractorId,
      dealId: input.dealId,
      workspaceId: expectedWorkspaceId,
      actorUid: text(input.actorUid),
      evaluatedAt,
    },
    readPaths,
    contractorIdentity: {
      requestedContractorId: input.contractorId,
      resolvedCanonicalContractorId: canonicalId,
      businessName: businessName(contractor),
      identityResolved: identity.identityResolved,
      identityStatus: identity.status,
      ambiguityOrDuplicateLinkage: linkageIssues(contractor, input.contractorId),
      archived: isArchived(contractor),
      status: text(contractor.status),
    },
    workspace: {
      contractorWorkspaceId: contractorWs,
      dealWorkspaceId,
      expectedWorkspaceId,
      matches: workspaceBlockers.length === 0,
      unresolvedWorkspacePaths: workspaceBlockers,
    },
    repositoryReadiness: {
      readinessDecisionStatus: repositoryDecision.readinessDecisionStatus,
      assignmentAllowed: repositoryDecision.assignmentAllowed,
      decisionLogicVersion: repositoryDecision.logicVersion,
      expectedLogicVersion: CONTRACTOR_REPOSITORY_DECISION_LOGIC_VERSION,
      stale: repositoryDecision.stale,
      staleReasons: repositoryDecision.staleReasons,
      blockers: repositoryDecision.blockingReasons,
      warnings: repositoryDecision.warnings,
    },
    requiredEvidence,
    csdAndSars: {
      supplierNumber: csdNumber,
      csdEvidenceStatus: csdStatus,
      sarsTcsStatus: sarsProjection.sarsVerificationStatus,
      supportingEvidencePath: csdDoc?.path ?? sarsRecord?.verificationEvidenceDocumentId ?? sarsRecord?.evidenceStoragePath ?? null,
      currency: sarsProjection.sarsRecheckDueAt && Date.parse(sarsProjection.sarsRecheckDueAt) <= Date.parse(evaluatedAt) ? "expired" : sarsProjection.evidenceAvailable ? "current" : "unknown",
      blockers: unique([
        ...(csdStatus === "VALID" ? [] : ["CSD supplier number is not verified as valid"]),
        ...sarsProjection.sarsVerificationBlockers,
        ...(sarsProjection.evidenceAvailable ? [] : ["SARS TCS supporting evidence is missing"]),
      ]),
    },
    opportunitySpecificAssignmentDecision: {
      dealPhase: stateWithoutContractorDocuments.currentPhase,
      phaseIsMatchingRequired,
      appearsInBoundedExecutionMatches: Boolean(rawMatch),
      uiAssignmentAllowedDecision: uiAllowed,
      serverCurrentCodeComplianceStatus: complianceCurrentCode.status,
      serverCurrentCodeBlockers: unique([...complianceCurrentCode.missing, ...complianceCurrentCode.expired.map((item) => `${item} expired`)]),
      canonicalEvidenceComplianceStatus: complianceCanonicalEvidence.status,
      canonicalEvidenceBlockers: unique([...complianceCanonicalEvidence.missing, ...complianceCanonicalEvidence.expired.map((item) => `${item} expired`)]),
      uiServerDisagreement: uiAllowed !== (complianceCanonicalEvidence.status === "VALID" && repositoryDecision.assignmentAllowed),
    },
    assignmentAuthorityPreview: {
      status: authorityBlockers.length === 0 ? "ALLOWED" : "BLOCKED",
      blockers: authorityBlockers,
      warnings,
      noWriteRecommendation: "Diagnostic only. Do not write, repair, assign, audit, migrate, or recompute from this output.",
      recommendedRepairCategory: recommendedRepairCategory(authorityBlockers),
    },
    dataShapeIssues: {
      listContractorsOmitsDocumentEvidenceNeededByOpportunityMatching: hasSubcollectionEvidence && !hasEmbeddedEvidence,
      selectorDataDiffersFromCanonicalRepositoryDecisionInputs: Boolean(buildContractorSelectorOption(contractor)),
      embeddedLegacyFlagsTrustedInsteadOfCurrentDocumentEvidence: complianceCurrentCode.status !== complianceCanonicalEvidence.status,
      repositoryReadyDiffersFromOpportunityAssignmentReadiness: repositoryDecision.assignmentAllowed !== Boolean(boundedMatchWithCurrentEvidence?.assignmentAllowed),
      details: dataShapeDetails,
    },
  };
}

export class FirestoreDiagnosticReader implements DiagnosticReader {
  async getDocument(path: string): Promise<DiagnosticDocumentSnapshot> {
    const snapshot = await getFirebaseAdmin().doc(path).get();
    return { exists: snapshot.exists, id: snapshot.id, path, data: snapshot.exists ? (snapshot.data() ?? {}) as AnyRecord : null };
  }

  async listSubcollection(path: string): Promise<DiagnosticDocumentSnapshot[]> {
    const snapshot = await getFirebaseAdmin().collection(path).get();
    return snapshot.docs.map((doc) => ({ exists: doc.exists, id: doc.id, path: `${path}/${doc.id}`, data: (doc.data() ?? {}) as AnyRecord }));
  }
}
