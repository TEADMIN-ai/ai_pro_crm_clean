import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  getContractorBusinessName,
  resolveContractorReference,
  type ContractorReferenceResolution,
} from "@/lib/contractors/contractorReferenceResolver";
import {
  calculateContractorCompliance,
  normalizeContractorUploadDocumentType,
  normalizeSupportedDocumentType,
  SUPPORTED_DOCUMENT_TYPES,
} from "@/lib/compliance/contractorCompliance";
import { recordAuditLog } from "@/server/services/auditLogService";
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

export async function listContractors(options: { includeArchived?: boolean } = {}) {
  const queryPath = "contractors";
  const snapshot = await getFirebaseAdmin().collection(queryPath).get();
  const rawContractors: Array<Record<string, unknown> & { id: string }> = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  }));
  const filteredDemoRecords = rawContractors.filter(isDemoContractorRecord).length;
  const contractors = await Promise.all(
    rawContractors
      .filter((contractor) => !isDemoContractorRecord(contractor))
      .filter((contractor) => options.includeArchived === true || contractor.archived !== true)
      .map(async (contractor) => enrichContractorListItem(contractor)),
  );
  const legacyRecords = contractors.filter((contractor) => !asString((contractor as Record<string, unknown>).workspaceId)).length;
  const sortedContractors = contractors.sort((a, b) => {
    const aCreatedAt = typeof a["createdAt"] === "number" ? a["createdAt"] : 0;
    const bCreatedAt = typeof b["createdAt"] === "number" ? b["createdAt"] : 0;
    return bCreatedAt - aCreatedAt;
  });

  console.info("[contractor-repository] list", {
    queryPath,
    filters: { excludedDemoRecords: true, workspaceId: null },
    recordsReturned: sortedContractors.length,
    legacyRecordsDetected: legacyRecords,
    rejectedCrossWorkspaceRecords: 0,
    filteredDemoRecords,
  });

  return sortedContractors;
}

function isDemoContractorRecord(contractor: Record<string, unknown>): boolean {
  return contractor.demoContractor === true ||
    contractor.benchmarkContractor === true ||
    contractor.regressionValidationContractor === true ||
    contractor.operationalReplayContractor === true ||
    contractor.canonicalProfile === true;
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

async function enrichContractorListItem(contractor: Record<string, unknown> & { id: string }) {
  const contractorId = asString(contractor.contractorId) ?? contractor.id;
  const documents = await listContractorDocuments(contractorId);
  const summary = calculateContractorCompliance(documents);
  const reviewRequiredCount = documents.filter(isReviewRequiredDocument).length;
  const requiredDocsApprovedCount = SUPPORTED_DOCUMENT_TYPES.length - summary.docsMissing;
  const hasFullDocumentReadiness =
    summary.docsMissing === 0 && summary.expiredDocumentCount === 0 && summary.tenderLockStatus === "READY";
  const complianceApproved = contractor.complianceApproved === true;
  const overallStatus =
    complianceApproved
      ? "Approved / Compliant"
      : hasFullDocumentReadiness
        ? "Pending Review"
        : reviewRequiredCount > 0
          ? "Review Required"
          : summary.docsMissing > 0
            ? "Onboarding"
            : "Pending Review";

  return {
    ...contractor,
    readinessScore:
      typeof contractor.readinessScore === "number" && Number.isFinite(contractor.readinessScore)
        ? contractor.readinessScore
        : summary.readinessScore,
    complianceStatusScore:
      typeof contractor.complianceStatusScore === "number" && Number.isFinite(contractor.complianceStatusScore)
        ? contractor.complianceStatusScore
        : summary.complianceStatusScore,
    docsMissing: summary.docsMissing,
    missingDocumentTypes: summary.missingDocumentTypes,
    tenderLockStatus: summary.tenderLockStatus,
    isTenderLocked: summary.isTenderLocked,
    requiredDocsApprovedCount,
    requiredDocsTotalCount: SUPPORTED_DOCUMENT_TYPES.length,
    reviewRequiredCount,
    overallStatus,
    complianceApproved,
    taxPinStatus: resolveDocumentSignal(documents, "taxClearance"),
    csdStatus: resolveDocumentSignal(documents, "csd"),
    lastDocumentUpdateAt: latestDocumentUpdate(documents) ?? contractor.lastDocumentUpdateAt ?? contractor.updatedAt ?? null,
  };
}

export async function createContractor(
  payload: Record<string, unknown>,
  actor?: Pick<AuthorizedUser, "uid" | "email" | "role">,
) {
  const createdAt = typeof payload.createdAt === "number" ? payload.createdAt : Date.now();
  const updatedAt = new Date(createdAt).toISOString();
  const companyName = asString(payload.companyName) ?? asString(payload.name) ?? "Unnamed Contractor";
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
    ...payload,
    id: contractorId,
    contractorId,
    companyName,
    name: asString(payload.name) ?? companyName,
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

export async function getContractorById(contractorId: string) {
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

function assertAdminArchiveActor(actor: ContractorArchiveActor): void {
  if (actor.role !== "admin") {
    throw new AuthorizationError("Contractor archive requires admin authorisation", 403);
  }
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

export async function archiveContractorById(input: {
  contractorId: string;
  reason: string;
  actor: ContractorArchiveActor;
}): Promise<Record<string, unknown> & { id: string }> {
  assertAdminArchiveActor(input.actor);
  const contractor = await getContractorById(input.contractorId);
  if (!contractor) {
    throw new Error("Contractor not found");
  }
  assertArchiveWorkspace(input.actor, contractor);

  const archivedAt = new Date().toISOString();
  const originalStatus = asString((contractor as Record<string, unknown>).status) ?? null;
  const archiveReason = input.reason.trim() || "Manual contractor repository archive";
  await updateContractorById(input.contractorId, {
    archived: true,
    archivedAt,
    archivedBy: input.actor.uid,
    archivedByEmail: input.actor.email ?? null,
    archiveReason,
    originalStatus,
  });

  await recordAuditLog({
    userId: input.actor.uid,
    action: "CONTRACTOR_ARCHIVED",
    entityType: "contractor",
    entityId: input.contractorId,
    metadata: { reason: archiveReason, originalStatus, archivedAt },
  });

  return (await getContractorById(input.contractorId)) as Record<string, unknown> & { id: string };
}

export async function restoreContractorById(input: {
  contractorId: string;
  actor: ContractorArchiveActor;
  reason?: string;
}): Promise<Record<string, unknown> & { id: string }> {
  assertAdminArchiveActor(input.actor);
  const contractor = await getContractorById(input.contractorId);
  if (!contractor) {
    throw new Error("Contractor not found");
  }
  assertArchiveWorkspace(input.actor, contractor);

  const restoredAt = new Date().toISOString();
  const restoreReason = input.reason?.trim() || "Manual contractor repository restore";
  await updateContractorById(input.contractorId, {
    archived: false,
    restoredAt,
    restoredBy: input.actor.uid,
    restoredByEmail: input.actor.email ?? null,
    restoreReason,
  });

  await recordAuditLog({
    userId: input.actor.uid,
    action: "CONTRACTOR_RESTORED",
    entityType: "contractor",
    entityId: input.contractorId,
    metadata: { reason: restoreReason, restoredAt },
  });

  return (await getContractorById(input.contractorId)) as Record<string, unknown> & { id: string };
}
