import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  getContractorBusinessName,
  resolveContractorReference,
  type ContractorReferenceResolution,
} from "@/lib/contractors/contractorReferenceResolver";
import {
  normalizeContractorUploadDocumentType,
  normalizeSupportedDocumentType,
  SUPPORTED_DOCUMENT_TYPES,
} from "@/lib/compliance/contractorCompliance";
import { recordAuditLog } from "@/server/services/auditLogService";
import { classifyContractorRecord, emptyContractorVisibilityDiagnostics, isContractorVisibleToWorkspace, updateContractorVisibilityDiagnostics, type ContractorVisibilityContext } from "@/lib/contractors/contractorVisibility";
import { buildUnresolvedContractorIdentityFields, resolveContractorBusinessIdentity } from "@/lib/contractors/contractorBusinessIdentity";
import { buildContractorOnboardingDecisionView } from "@/lib/contractors/contractorOnboardingDecisionView";
import { AuthorizationError, type AuthorizedUser } from "@/lib/server/authz";
import type { ContractorTier } from "@/types/contractor";
import type { ContractorDocument } from "@/types/document";

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return undefined;
}

function hasTimestamp(value: unknown): boolean {
  return typeof toMillis(value) === "number";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function omitContractorBusinessIdentityFields(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...payload };
  for (const key of [
    "legalName",
    "businessName",
    "registeredBusinessName",
    "companyName",
    "tradingName",
    "name",
    "allowUnresolvedIdentity",
  ]) {
    delete sanitized[key];
  }
  return sanitized;
}
function normalizeTier(value: unknown): ContractorTier {
  return value === "bronze" || value === "silver" || value === "gold" || value === "platinum" ? value : "basic";
}

function defaultSubmissionLimitForTier(tier: ContractorTier): number {
  switch (tier) {
    case "bronze":
      return 5;
    case "silver":
      return 15;
    case "gold":
      return 50;
    case "platinum":
      return 250;
    case "basic":
    default:
      return 1;
  }
}

export type ListContractorsOptions = ContractorVisibilityContext;
export async function listContractors(options: ListContractorsOptions) {
  const queryPath = "contractors";
  const snapshot = await getFirebaseAdmin().collection(queryPath).get();
  const rawContractors: Array<Record<string, unknown> & { id: string }> = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
  const diagnostics = emptyContractorVisibilityDiagnostics();
  const visibleContractors = rawContractors.filter((contractor) => { const decision = isContractorVisibleToWorkspace(contractor, options); updateContractorVisibilityDiagnostics(diagnostics, decision); return decision.visible; });
  const contractors = await Promise.all(visibleContractors.map(async (contractor) => ({ ...(await enrichContractorListItem(contractor)), recordClassification: classifyContractorRecord(contractor) })));
  const sortedContractors = contractors.sort((a, b) => { const aCreatedAt = typeof a["createdAt"] === "number" ? a["createdAt"] : 0; const bCreatedAt = typeof b["createdAt"] === "number" ? b["createdAt"] : 0; return bCreatedAt !== aCreatedAt ? bCreatedAt - aCreatedAt : String(a.id).localeCompare(String(b.id)); });
  console.info("[contractor-repository] list", { queryPath, filters: { workspaceId: options.workspaceId ?? null, includeArchived: options.includeArchived === true, includeNonProduction: options.includeNonProduction === true, includeLegacyUnassigned: options.includeLegacyUnassigned === true }, diagnostics });
  return sortedContractors;
}

function isReviewRequiredDocument(document: ContractorDocument): boolean {
  return Boolean(document.fileUrl) &&
    document.verified !== true &&
    (document.validationStatus === "REVIEW" ||
      document.manualDecisionAvailable === true ||
      document.aiStatus === "failed" ||
      document.extractionSource === "EMPTY" ||
      document.status === "uploaded");
}

function latestDocumentUpdate(documents: ContractorDocument[]): number | null {
  const values = documents
    .map((document) => document.updatedAt ?? document.uploadedAt ?? document.createdAt ?? document.extractedAt ?? null)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return values.length ? Math.max(...values) : null;
}

function resolveDocumentSignal(documents: ContractorDocument[], type: "taxClearance" | "csd"): string {
  const matching = documents.filter((document) => {
    const normalized =
      type === "csd"
        ? normalizeContractorUploadDocumentType(document.documentType ?? document.docType ?? document.id)
        : normalizeSupportedDocumentType(document.documentType ?? document.docType ?? document.id);
    return normalized === type;
  });

  if (matching.some((document) => document.verified === true)) {
    return "Verified";
  }

  if (matching.some(isReviewRequiredDocument)) {
    return "Review required";
  }

  if (matching.some((document) => Boolean(document.fileUrl))) {
    return "Uploaded";
  }

  return "Missing";
}



function repositoryDocumentSignalLabel(status: string): string {
  return status === "VALID" ? "Verified" : status === "INVALID" ? "Invalid" : "Unresolved";
}

function safeRepositoryContractorFields(contractor: Record<string, unknown> & { id: string }) {
  return {
    id: contractor.id,
    contractorId: asString(contractor.contractorId) ?? contractor.id,
    workspaceId: asString(contractor.workspaceId),
    workspaceSlug: asString(contractor.workspaceSlug),
    archived: contractor.archived === true,
    archivedAt: contractor.archivedAt ?? null,
    archiveReason: asString(contractor.archiveReason),
    companyName: asString(contractor.companyName),
    businessName: asString(contractor.businessName),
    legalName: asString(contractor.legalName),
    tradingName: asString(contractor.tradingName),
    name: asString(contractor.name),
    status: asString(contractor.status),
    createdAt: contractor.createdAt ?? null,
    updatedAt: contractor.updatedAt ?? null,
    lastDocumentUpdateAt: contractor.lastDocumentUpdateAt ?? null,
    registrationNumber: asString(contractor.registrationNumber),
    companyRegistrationNumber: asString(contractor.companyRegistrationNumber),
    csdNumber: asString(contractor.csdNumber),
    csdMNumber: asString(contractor.csdMNumber),
    mNumber: asString(contractor.mNumber),
    teosContractorReference: asString(contractor.teosContractorReference),
    contractorReference: asString(contractor.contractorReference),
    contractorNumber: asString(contractor.contractorNumber),
    businessReference: asString(contractor.businessReference),
  };
}

async function enrichContractorListItem(contractor: Record<string, unknown> & { id: string }) {
  const contractorId = asString(contractor.contractorId) ?? contractor.id;
  const documents = await listContractorDocuments(contractorId);
  const decision = buildContractorOnboardingDecisionView({ contractor, documents });
  const summary = decision.documentSummary;
  const reviewRequiredCount = documents.filter(isReviewRequiredDocument).length;
  const requiredDocsApprovedCount = SUPPORTED_DOCUMENT_TYPES.length - summary.docsMissing;

  return {
    ...safeRepositoryContractorFields(contractor),
    readinessScore: decision.readinessScore,
    readinessStatus: decision.readinessDecisionStatus,
    complianceStatusScore: decision.complianceDecisionStatus === "VALID" ? summary.complianceStatusScore : null,
    complianceStatus: decision.complianceDecisionStatus,
    complianceDecisionStatus: decision.complianceDecisionStatus,
    readinessDecisionStatus: decision.readinessDecisionStatus,
    documentCompletenessScore: decision.documentCompletenessScore,
    documentReviewStatus: decision.documentReviewStatus,
    externalVerificationStatus: decision.externalVerificationStatus,
    identityMatchStatus: decision.identityMatchStatus,
    identityStatus: decision.identityStatus,
    assignmentAllowed: decision.assignmentAllowed,
    blockingReasons: decision.blockingReasons,
    warnings: decision.warnings,
    evaluatedAt: decision.evaluatedAt,
    logicVersion: decision.logicVersion,
    stale: decision.stale,
    staleReasons: decision.staleReasons,
    csdValidationStatus: decision.csdValidationStatus,
    registrationValidationStatus: decision.registrationValidationStatus,
    documentSummary: decision.documentSummary,
    assignmentSummary: decision.assignmentSummary,
    reviewSummary: decision.reviewSummary,
    historicalDecision: decision.historicalDecision,
    docsMissing: summary.docsMissing,
    missingDocumentTypes: summary.missingDocumentTypes,
    tenderLockStatus: decision.readinessDecisionStatus === "READY" ? "READY" : "BLOCKED",
    isTenderLocked: decision.readinessDecisionStatus !== "READY",
    requiredDocsApprovedCount,
    requiredDocsTotalCount: SUPPORTED_DOCUMENT_TYPES.length,
    reviewRequiredCount,
    overallStatus: decision.overallStatus,
    complianceApproved: decision.complianceDecisionStatus === "VALID",
    taxPinStatus: resolveDocumentSignal(documents, "taxClearance"),
    csdStatus: repositoryDocumentSignalLabel(decision.csdValidationStatus),
    lastDocumentUpdateAt: latestDocumentUpdate(documents) ?? contractor.lastDocumentUpdateAt ?? contractor.updatedAt ?? null,
    recordClassification: classifyContractorRecord(contractor),
  };
}

export async function createContractor(
  payload: Record<string, unknown>,
  actor?: Pick<AuthorizedUser, "uid" | "email" | "role">,
) {
  const createdAt = typeof payload.createdAt === "number" ? payload.createdAt : Date.now();
  const updatedAt = new Date(createdAt).toISOString();
  const identityDecision = resolveContractorBusinessIdentity(payload);
  if (identityDecision.status === "CONFLICT") {
    throw new Error("Contractor business identity evidence is conflicting");
  }
  const allowUnresolvedIdentity = payload.allowUnresolvedIdentity === true;
  if (!identityDecision.identityResolved && !allowUnresolvedIdentity) {
    throw new Error("Verified contractor business identity is required");
  }
  const safePayload = omitContractorBusinessIdentityFields(payload);
  const companyRegistrationNumber = asString(payload.companyRegistrationNumber) ?? asString(payload.registrationNumber);
  const email = asString(payload.email) ?? asString(payload.contactEmail);
  const phone = asString(payload.phone) ?? asString(payload.contactPhone);
  const status = asString(payload.status) ?? "pending";
  const tier = normalizeTier(payload.tier);
  const submissionsUsed = asNumber(payload.submissionsUsed) ?? 0;
  const submissionsLimit = asNumber(payload.submissionsLimit) ?? defaultSubmissionLimitForTier(tier);
  const createdBy = actor?.uid ?? asString(payload.createdBy) ?? null;
  const metadata =
    payload.metadata && typeof payload.metadata === "object"
      ? { ...(payload.metadata as Record<string, unknown>) }
      : {};

  const docRef = getFirebaseAdmin().collection("contractors").doc();
  const contractorId = docRef.id;
  const auditTrailEntry = {
    id: `${contractorId}:created:${createdAt}`,
    type: "contractor_created",
    message: "Contractor created",
    performedByUid: createdBy,
    performedByEmail: actor?.email ?? null,
    performedByRole: actor?.role ?? null,
    createdAt: updatedAt,
  };

  await docRef.set({
    ...safePayload,
    id: contractorId,
    contractorId,
    ...(identityDecision.identityResolved
      ? {
          legalName: identityDecision.legalName,
          tradingName: identityDecision.tradingName,
          registeredBusinessName: identityDecision.registeredBusinessName,
          companyName: identityDecision.companyName ?? identityDecision.label,
          name: identityDecision.label,
          identityResolved: true,
          identityStatus: "VERIFIED",
          identityResolutionStatus: "VERIFIED",
          businessIdentityEvidenceStatus: "VERIFIED",
        }
      : buildUnresolvedContractorIdentityFields({
          source: "contractorService.createContractor",
          sourceUserUid: createdBy,
          workspaceId: asString(payload.workspaceId),
          nowIso: updatedAt,
        })),
    companyRegistrationNumber: companyRegistrationNumber ?? null,
    registrationNumber: companyRegistrationNumber ?? null,
    email: email ?? null,
    contactEmail: email ?? null,
    phone: phone ?? null,
    contactPhone: phone ?? null,
    status,
    tier,
    submissionsUsed,
    submissionsLimit,
    createdAt,
    updatedAt,
    createdBy,
    createdByEmail: actor?.email ?? null,
    createdByRole: actor?.role ?? null,
    metadata: {
      createdVia: "contractorService.createContractor",
      ...metadata,
      lastUpdatedByUid: createdBy,
      lastUpdatedByEmail: actor?.email ?? null,
      lastUpdatedByRole: actor?.role ?? null,
      lastUpdatedAt: updatedAt,
    },
    auditTrail: Array.isArray(payload.auditTrail)
      ? [...payload.auditTrail, auditTrailEntry]
      : [auditTrailEntry],
  });

  return docRef.id;
}

export async function getContractorById(contractorId: string): Promise<(Record<string, unknown> & { id: string }) | null> {
  const snapshot = await getFirebaseAdmin().collection("contractors").doc(contractorId).get();
  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function resolveContractorForAccess(input: {
  contractorReference: string;
  actor?: Pick<AuthorizedUser, "role" | "contractorId"> | null;
  expectedWorkspaceId?: string | null;
  dealId?: string | null;
  logContext?: string;
}): Promise<ContractorReferenceResolution> {
  return resolveContractorReference({
    reference: input.contractorReference,
    actor: input.actor,
    expectedWorkspaceId: input.expectedWorkspaceId,
    dealId: input.dealId,
    logContext: input.logContext,
  });
}

export function getContractorDisplayName(contractor: Record<string, unknown>): string {
  return getContractorBusinessName(contractor);
}

export async function updateContractorById(contractorId: string, updates: Record<string, unknown>) {
  await getFirebaseAdmin().collection("contractors").doc(contractorId).update({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteContractorById(_contractorId: string) {
  void _contractorId;
  throw new Error("Hard deletion of contractor records is disabled. Use archiveContractorById instead.");
}

export async function listContractorDocuments(contractorId: string) {
  const snapshot = await getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .get();

  return snapshot.docs.map((doc) => {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const document: ContractorDocument = {
      aiStatus:
        data.aiStatus === "pending" || data.aiStatus === "complete" || data.aiStatus === "failed"
          ? data.aiStatus
          : undefined,
      aiError: asString(data.aiError),
      aiSuggestion: asString(data.aiSuggestion),
      aiData:
        data.aiData && typeof data.aiData === "object"
          ? (data.aiData as ContractorDocument["aiData"])
          : undefined,
      riskLevel:
        data.riskLevel === "low" ||
        data.riskLevel === "medium" ||
        data.riskLevel === "high" ||
        data.riskLevel === "unknown"
          ? data.riskLevel
          : undefined,
      aiIssues: Array.isArray(data.aiIssues)
        ? data.aiIssues.filter((value): value is string => typeof value === "string")
        : undefined,
      id: doc.id,
      contractorId: asString(data.contractorId) ?? contractorId,
      documentName: asString(data.documentName) ?? asString(data.fileName),
      documentType: asString(data.documentType) ?? asString(data.docType),
      docType: asString(data.docType),
      fileName: asString(data.fileName),
      originalName: asString(data.originalName),
      filename: asString(data.filename),
      storagePath: asString(data.storagePath),
      fileUrl: asString(data.fileUrl) ?? asString(data.downloadURL) ?? asString(data.url),
      downloadURL: asString(data.downloadURL) ?? asString(data.fileUrl),
      verified: data.verified === true || hasTimestamp(data.verifiedAt),
      verifiedAt: toMillis(data.verifiedAt),
      verifiedBy: asString(data.verifiedBy),
      verificationMethod:
        data.verificationMethod === "AI" || data.verificationMethod === "MANUAL"
          ? data.verificationMethod
          : undefined,
      verificationStatus: asString(data.verificationStatus),
      verificationNote: asString(data.verificationNote),
      rejectedBy: asString(data.rejectedBy),
      rejectedAt: toMillis(data.rejectedAt),
      rejectionReason: asString(data.rejectionReason),
      validationStatus:
        data.validationStatus === "PASS" || data.validationStatus === "REVIEW" || data.validationStatus === "FAIL"
          ? data.validationStatus
          : undefined,
      validationError: asString(data.validationError),
      reviewReason: asString(data.reviewReason),
      reviewedBy: asString(data.reviewedBy),
      reviewedAt: toMillis(data.reviewedAt),
      manualDecisionAvailable: data.manualDecisionAvailable === true,
      isExpired: data.isExpired === true,
      confidenceNotes: Array.isArray(data.confidenceNotes)
        ? data.confidenceNotes.filter((value): value is string => typeof value === "string")
        : undefined,
      suggestions: Array.isArray(data.suggestions)
        ? data.suggestions.filter((value): value is string => typeof value === "string")
        : undefined,
      uploadedAt: toMillis(data.uploadedAt),
      createdAt: toMillis(data.createdAt),
      updatedAt: toMillis(data.updatedAt),
      extractedAt: toMillis(data.extractedAt),
      expiresAt: typeof data.expiresAt === "number" ? data.expiresAt : undefined,
      expiryDate: typeof data.expiryDate === "number" ? data.expiryDate : undefined,
      confidenceScore: typeof data.confidenceScore === "number" ? data.confidenceScore : undefined,
      extractedFields:
        data.extractedFields && typeof data.extractedFields === "object"
          ? (data.extractedFields as Record<string, string | null>)
          : undefined,
      missingFields: Array.isArray(data.missingFields)
        ? data.missingFields.filter((value): value is string => typeof value === "string")
        : undefined,
      issues: Array.isArray(data.issues)
        ? data.issues.filter((value): value is string => typeof value === "string")
        : undefined,
      validationErrors: Array.isArray(data.validationErrors)
        ? data.validationErrors.filter((value): value is string => typeof value === "string")
        : undefined,
      analysisTimestamp: toMillis(data.analysisTimestamp),
      extractionMethod:
        data.extractionMethod === "pdf-parse" || data.extractionMethod === "ocr"
          ? data.extractionMethod
          : undefined,
      extractedText: asString(data.extractedText),
      extractedTextLength:
        typeof data.extractedTextLength === "number" ? data.extractedTextLength : undefined,
      directTextLength:
        typeof data.directTextLength === "number" ? data.directTextLength : undefined,
      ocrTextLength:
        typeof data.ocrTextLength === "number" ? data.ocrTextLength : undefined,
      pageCount:
        typeof data.pageCount === "number" ? data.pageCount : undefined,
      extractionSource:
        data.extractionSource === "PDF_TEXT" || data.extractionSource === "OCR" || data.extractionSource === "EMPTY"
          ? data.extractionSource
          : undefined,
      status: asString(data.status),
    };

    return document;
  });
}

export async function upsertContractorDocument(
  contractorId: string,
  documentType: string,
  payload: Record<string, unknown>,
) {
  await getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .doc(documentType)
    .set(payload, { merge: true });
}

export async function getContractorDocument(contractorId: string, documentType: string) {
  const snapshot = await getFirebaseAdmin()
    .collection("contractors")
    .doc(contractorId)
    .collection("documents")
    .doc(documentType)
    .get();

  return snapshot;
}


export type ContractorArchiveActor = Pick<AuthorizedUser, "uid" | "email" | "role"> & {
  workspaceId?: string | null;
};

export type ContractorDependencySummary = {
  linkedUserCount: number;
  linkedOpportunityCount: number;
  activeAssignmentCount: number;
  documentCount: number;
  tenderPackCount: number;
  submissionReviewCount: number;
};

function assertAdminArchiveActor(actor: ContractorArchiveActor): void {
  if (actor.role !== "admin") throw new AuthorizationError("Contractor archive requires admin authorisation", 403);
}

function contractorWorkspaceId(contractor: Record<string, unknown>): string | null {
  const workspace = contractor.workspace && typeof contractor.workspace === "object"
    ? (contractor.workspace as Record<string, unknown>)
    : null;
  return asString(contractor.workspaceId) ?? asString(workspace?.id) ?? null;
}

function assertArchiveWorkspace(actor: ContractorArchiveActor, contractor: Record<string, unknown>): void {
  const actorWorkspaceId = asString(actor.workspaceId);
  const recordWorkspaceId = contractorWorkspaceId(contractor);
  if (actorWorkspaceId && recordWorkspaceId && actorWorkspaceId !== recordWorkspaceId) {
    throw new AuthorizationError("Cross-workspace contractor archive rejected", 403);
  }
}

function normalizeContractorId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/^contractors\//, "");
  return normalized && normalized.length <= 150 && !normalized.includes("/") ? normalized : null;
}

function containsContractorReference(value: unknown, contractorId: string): boolean {
  if (typeof value === "string") return value === contractorId || value === `contractors/${contractorId}`;
  if (Array.isArray(value)) return value.some((item) => containsContractorReference(item, contractorId));
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).some((item) => containsContractorReference(item, contractorId));
  return false;
}

async function readCollectionRecords(collectionName: string): Promise<Record<string, unknown>[]> {
  try {
    const snapshot = await getFirebaseAdmin().collection(collectionName).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...((doc.data() ?? {}) as Record<string, unknown>) }));
  } catch {
    return [];
  }
}

export async function getContractorDependencySummary(contractorId: string): Promise<ContractorDependencySummary> {
  const [contractorDocuments, users, deals, tenderPacks, tenderPackRequests, submissionReviews] = await Promise.all([
    listContractorDocuments(contractorId),
    readCollectionRecords("users"),
    readCollectionRecords("deals"),
    readCollectionRecords("tenderPacks"),
    readCollectionRecords("tenderPackRequests"),
    readCollectionRecords("submissionReviews"),
  ]);
  const linkedUsers = users.filter((record) => containsContractorReference(record, contractorId));
  const linkedDeals = deals.filter((record) => containsContractorReference(record, contractorId));
  const activeAssignments = linkedDeals.filter((record) => {
    const assignment = record.contractorAssignment;
    return Boolean(assignment && typeof assignment === "object" && (assignment as Record<string, unknown>).assignmentStatus === "assigned");
  });
  const linkedTenderPacks = [...tenderPacks, ...tenderPackRequests].filter((record) => containsContractorReference(record, contractorId));
  const linkedSubmissionReviews = submissionReviews.filter((record) => containsContractorReference(record, contractorId));

  return {
    linkedUserCount: linkedUsers.length,
    linkedOpportunityCount: linkedDeals.length,
    activeAssignmentCount: activeAssignments.length,
    documentCount: contractorDocuments.length,
    tenderPackCount: linkedTenderPacks.length,
    submissionReviewCount: linkedSubmissionReviews.length,
  };
}

export async function archiveContractorById(input: {
  contractorId: string;
  reason: string;
  actor: ContractorArchiveActor;
  replacementContractorId?: string | null;
  dependencySummary?: ContractorDependencySummary;
  confirmActiveAssignments?: boolean;
}): Promise<Record<string, unknown> & { id: string }> {
  assertAdminArchiveActor(input.actor);
  const contractorId = normalizeContractorId(input.contractorId);
  if (!contractorId) throw new Error("Malformed contractor ID");
  const archiveReason = input.reason.trim();
  if (!archiveReason) throw new Error("Archive reason is required");
  const contractor = await getContractorById(contractorId);
  if (!contractor) throw new Error("Contractor not found");
  assertArchiveWorkspace(input.actor, contractor);

  if (contractor.archived === true || String(contractor.status ?? "").toLowerCase() === "archived") {
    return contractor as Record<string, unknown> & { id: string };
  }

  const archivedAt = new Date().toISOString();
  const originalStatus = asString(contractor.status) ?? null;
  const replacementContractorId = normalizeContractorId(input.replacementContractorId);
  const dependencySummary = await getContractorDependencySummary(contractorId);
  if (dependencySummary.activeAssignmentCount > 0 && input.confirmActiveAssignments !== true) throw new Error("Active assignments require explicit confirmation");
  const lifecycle = {
    status: "archived",
    archivedAt,
    archivedByUid: input.actor.uid,
    archivedByEmail: input.actor.email ?? null,
    archiveReason,
    replacementContractorId,
  };
  await updateContractorById(contractorId, {
    archived: true,
    status: "archived",
    archivedAt,
    archivedBy: input.actor.uid,
    archivedByUid: input.actor.uid,
    archivedByEmail: input.actor.email ?? null,
    archiveReason,
    originalStatus,
    replacementContractorId,
    contractorLifecycle: lifecycle,
  });

  await recordAuditLog({
    userId: input.actor.uid,
    action: "CONTRACTOR_ARCHIVED",
    entityType: "contractor",
    entityId: contractorId,
    metadata: {
      contractorId,
      contractorName: getContractorDisplayName(contractor),
      previousStatus: originalStatus,
      newStatus: "archived",
      reason: archiveReason,
      replacementContractorId,
      actorUid: input.actor.uid,
      actorEmail: input.actor.email ?? null,
      archivedAt,
      dependencySummary,
    },
  });

  return (await getContractorById(contractorId)) as Record<string, unknown> & { id: string };
}

export async function restoreContractorById(input: {
  contractorId: string;
  actor: ContractorArchiveActor;
  reason?: string;
}): Promise<Record<string, unknown> & { id: string }> {
  assertAdminArchiveActor(input.actor);
  const contractorId = normalizeContractorId(input.contractorId);
  if (!contractorId) throw new Error("Malformed contractor ID");
  const contractor = await getContractorById(contractorId);
  if (!contractor) throw new Error("Contractor not found");
  assertArchiveWorkspace(input.actor, contractor);

  if (contractor.archived !== true && String(contractor.status ?? "").toLowerCase() !== "archived") {
    return contractor as Record<string, unknown> & { id: string };
  }

  const restoredAt = new Date().toISOString();
  const restoreReason = input.reason?.trim() || "Manual contractor repository restore";
  const previousStatus = asString(contractor.status) ?? "archived";
  const originalStatus = asString(contractor.originalStatus);
  const restoredStatus = originalStatus && originalStatus.toLowerCase() !== "archived" ? originalStatus : "pending";
  const replacementContractorId = normalizeContractorId(contractor.replacementContractorId);
  await updateContractorById(contractorId, {
    archived: false,
    status: restoredStatus,
    restoredAt,
    restoredBy: input.actor.uid,
    restoredByUid: input.actor.uid,
    restoredByEmail: input.actor.email ?? null,
    restoreReason,
    contractorLifecycle: {
      status: restoredStatus,
      restoredAt,
      restoredByUid: input.actor.uid,
      restoredByEmail: input.actor.email ?? null,
      restoreReason,
      replacementContractorId,
    },
  });

  await recordAuditLog({
    userId: input.actor.uid,
    action: "CONTRACTOR_RESTORED",
    entityType: "contractor",
    entityId: contractorId,
    metadata: {
      contractorId,
      contractorName: getContractorDisplayName(contractor),
      previousStatus,
      newStatus: restoredStatus,
      reason: restoreReason,
      replacementContractorId,
      actorUid: input.actor.uid,
      actorEmail: input.actor.email ?? null,
      restoredAt,
    },
  });

  return (await getContractorById(contractorId)) as Record<string, unknown> & { id: string };
}
