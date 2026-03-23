import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import type { AuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { recordAuditLog } from "@/server/services/auditLogService";
import {
  getContractorDocument,
  upsertContractorDocument,
} from "@/server/services/contractorService";
import type { ContractorDocument } from "@/types/document";
import type { AuditLogAction } from "@/types/auditLog";

export type ManualVerificationAction = "approve" | "reject" | "request_reupload";

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

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeDocument(contractorId: string, documentId: string, data: Record<string, unknown>): ContractorDocument {
  return {
    id: documentId,
    contractorId,
    documentName: asString(data.documentName) ?? asString(data.fileName),
    documentType: asString(data.documentType) ?? asString(data.docType),
    docType: asString(data.docType),
    fileName: asString(data.fileName),
    originalName: asString(data.originalName),
    filename: asString(data.filename),
    storagePath: asString(data.storagePath),
    fileUrl: asString(data.fileUrl) ?? asString(data.downloadURL) ?? asString(data.url),
    downloadURL: asString(data.downloadURL) ?? asString(data.fileUrl),
    verified: data.verified === true || typeof toMillis(data.verifiedAt) === "number",
    verifiedAt: toMillis(data.verifiedAt),
    verifiedBy: asString(data.verifiedBy),
    validationStatus:
      data.validationStatus === "PASS" || data.validationStatus === "REVIEW" || data.validationStatus === "FAIL"
        ? data.validationStatus
        : undefined,
    validationError: asString(data.validationError),
    reviewReason: asString(data.reviewReason),
    reviewedBy: asString(data.reviewedBy),
    reviewedAt: toMillis(data.reviewedAt),
    manualDecisionAvailable: data.manualDecisionAvailable === true,
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
    validationErrors: Array.isArray(data.validationErrors)
      ? data.validationErrors.filter((value): value is string => typeof value === "string")
      : undefined,
    analysisTimestamp: toMillis(data.analysisTimestamp),
    extractionMethod:
      data.extractionMethod === "pdf-parse" || data.extractionMethod === "ocr"
        ? data.extractionMethod
        : undefined,
    extractedTextLength: typeof data.extractedTextLength === "number" ? data.extractedTextLength : undefined,
    status: asString(data.status),
  };
}

function resolveAuditAction(action: ManualVerificationAction): AuditLogAction {
  switch (action) {
    case "approve":
      return "MANUAL_VERIFICATION_APPROVED";
    case "reject":
      return "MANUAL_VERIFICATION_REJECTED";
    case "request_reupload":
      return "MANUAL_VERIFICATION_REUPLOAD_REQUESTED";
  }
}

function buildReviewUpdate(action: ManualVerificationAction, reviewReason: string | undefined, actor: AuthorizedUser) {
  const now = new Date();
  const nowIso = now.toISOString();
  const reviewedBy = actor.email?.trim() || actor.uid;
  const verificationAuditEntry = {
    action: "verified",
    by: actor.email?.trim() || "unknown",
    at: nowIso,
  };

  switch (action) {
    case "approve":
      return {
        verified: true,
        verifiedAt: nowIso,
        verifiedBy: actor.email?.trim() || "unknown",
        validationStatus: "PASS" as const,
        status: "verified",
        validationError: null,
        reviewReason: reviewReason ?? null,
        reviewedBy,
        reviewedAt: now,
        manualDecisionAvailable: false,
        auditTrail: [verificationAuditEntry],
      };
    case "reject":
      return {
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
        validationStatus: "FAIL" as const,
        status: "invalid",
        validationError: reviewReason ?? "Manual verification rejected",
        reviewReason: reviewReason ?? null,
        reviewedBy,
        reviewedAt: now,
        manualDecisionAvailable: false,
      };
    case "request_reupload":
      return {
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
        validationStatus: "REVIEW" as const,
        status: "uploaded",
        validationError: reviewReason ?? "Manual reviewer requested a new upload",
        reviewReason: reviewReason ?? null,
        reviewedBy,
        reviewedAt: now,
        manualDecisionAvailable: false,
      };
  }
}

export async function applyManualDocumentVerification(params: {
  contractorId: string;
  documentType: string;
  action: ManualVerificationAction;
  actor: AuthorizedUser;
  reviewReason?: string;
}): Promise<ContractorDocument> {
  const snap = await getContractorDocument(params.contractorId, params.documentType);
  if (!snap.exists) {
    throw new Error("Document not found");
  }

  const current = (snap.data() ?? {}) as Record<string, unknown>;
  const previousStatus =
    current.validationStatus === "PASS" || current.validationStatus === "REVIEW" || current.validationStatus === "FAIL"
      ? current.validationStatus
      : typeof current.status === "string"
        ? current.status
        : "uploaded";

  const reviewUpdate = buildReviewUpdate(params.action, params.reviewReason?.trim() || undefined, params.actor);
  const payload = {
    ...reviewUpdate,
    auditTrail: [
      ...((Array.isArray(current.auditTrail) ? current.auditTrail : []) as Record<string, unknown>[]),
      ...(reviewUpdate.auditTrail ?? []),
    ],
    updatedAt: new Date(),
  };

  await upsertContractorDocument(params.contractorId, params.documentType, payload);

  await recordAuditLog({
    userId: params.actor.uid,
    action: resolveAuditAction(params.action),
    entityType: "document",
    entityId: params.documentType,
    metadata: {
      contractorId: params.contractorId,
      previousStatus,
      newStatus: payload.validationStatus,
      reviewReason: params.reviewReason?.trim() || null,
      reviewedBy: payload.reviewedBy,
      reviewedAt: payload.reviewedAt.toISOString(),
    },
  });

  await recalculateContractorCompliance(getFirebaseAdmin(), params.contractorId);

  const updated = await getContractorDocument(params.contractorId, params.documentType);
  return normalizeDocument(
    params.contractorId,
    updated.id,
    (updated.data() ?? {}) as Record<string, unknown>
  );
}
