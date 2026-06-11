import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity/logActivity";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { buildContractorDocumentDownloadUrl } from "@/lib/documents/contractorDocumentDownloadUrl";
import {
  getDocumentTypeLabel,
  resolveContractorDocumentStatus,
  isSupportedDocumentType,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import {
  AuthorizationError,
  assertCanAccessContractor,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { ROUTE_CLASSIFICATIONS, MUTATION_CLASSIFICATIONS } from "@/lib/governance/classification";
import { emitGovernanceEvent } from "@/lib/governance/emitter";
import { withGovernanceObservation } from "@/lib/governance/observer";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import {
  getContractorDocument,
  listContractorDocuments,
  upsertContractorDocument,
} from "@/server/services/contractorService";
import type { ContractorDocument } from "@/types/document";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

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

function normalizeDocument(id: string, data: Record<string, unknown>): ContractorDocument {
  const document: ContractorDocument = {
    aiStatus:
      data.aiStatus === "pending" || data.aiStatus === "complete" || data.aiStatus === "failed"
        ? data.aiStatus
        : undefined,
    aiError: typeof data.aiError === "string" ? data.aiError : undefined,
    aiSuggestion: typeof data.aiSuggestion === "string" ? data.aiSuggestion : undefined,
    id,
    contractorId: typeof data.contractorId === "string" ? data.contractorId : "",
    documentName:
      typeof data.documentName === "string"
        ? data.documentName
        : typeof data.fileName === "string"
          ? data.fileName
          : undefined,
    documentType:
      typeof data.documentType === "string"
        ? data.documentType
        : typeof data.docType === "string"
          ? data.docType
          : undefined,
    docType: typeof data.docType === "string" ? data.docType : undefined,
    fileName: typeof data.fileName === "string" ? data.fileName : undefined,
    originalName: typeof data.originalName === "string" ? data.originalName : undefined,
    filename: typeof data.filename === "string" ? data.filename : undefined,
    storagePath: typeof data.storagePath === "string" ? data.storagePath : undefined,
    fileUrl:
      typeof data.fileUrl === "string"
        ? data.fileUrl
        : typeof data.downloadURL === "string"
          ? data.downloadURL
          : typeof data.url === "string"
            ? data.url
            : undefined,
    downloadURL:
      typeof data.downloadURL === "string"
        ? data.downloadURL
        : typeof data.fileUrl === "string"
          ? data.fileUrl
          : undefined,
    verified: data.verified === true || hasTimestamp(data.verifiedAt),
    verifiedAt: toMillis(data.verifiedAt),
    verifiedBy: typeof data.verifiedBy === "string" ? data.verifiedBy : undefined,
    validationStatus:
      data.validationStatus === "PASS" || data.validationStatus === "REVIEW" || data.validationStatus === "FAIL"
        ? data.validationStatus
        : undefined,
    validationError: typeof data.validationError === "string" ? data.validationError : undefined,
    reviewReason: typeof data.reviewReason === "string" ? data.reviewReason : undefined,
    reviewedBy: typeof data.reviewedBy === "string" ? data.reviewedBy : undefined,
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
    isExpired: data.isExpired === true,
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
    status: typeof data.status === "string" ? data.status : undefined,
  };

  return {
    ...document,
    status: resolveContractorDocumentStatus(document),
  };
}

function parseDocumentType(value: unknown): SupportedDocumentType | null {
  const type = getString(value);
  return isSupportedDocumentType(type) ? type : null;
}

function getFileNameFromStoragePath(storagePath: string): string {
  const segments = storagePath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "document.pdf";
}

function isValidStoragePath(contractorId: string, documentType: SupportedDocumentType, storagePath: string): boolean {
  const normalizedPath = storagePath.trim();
  const escapedDocumentType = documentType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expectedPattern = new RegExp(`^contractors/${contractorId}/${escapedDocumentType}(?:_\\d+)?\\.pdf$`);
  return expectedPattern.test(normalizedPath);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await context.params;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    assertCanAccessContractor(user, contractorId);

    const documents = await listContractorDocuments(contractorId);

    return NextResponse.json({ documents }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error(error);
    return jsonError(error instanceof Error ? error.message : "Failed to fetch documents", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await context.params;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    assertCanAccessContractor(user, contractorId);

    const body = (await request.json()) as Record<string, unknown>;
    const documentType = parseDocumentType(body.documentType);
    const documentName = getString(body.documentName);
    const storagePath = getString(body.storagePath);
    const fileUrl = buildContractorDocumentDownloadUrl(contractorId, documentType);

    if (!documentType) {
      return jsonError("Unsupported documentType", 400);
    }

    if (!storagePath) {
      return jsonError("Missing storagePath", 400);
    }

    if (!isValidStoragePath(contractorId, documentType, storagePath)) {
      return jsonError("Invalid storagePath", 400);
    }

    const fileNameFromStoragePath = getFileNameFromStoragePath(storagePath);
    const now = new Date();
    await upsertContractorDocument(
      contractorId,
      documentType,
      {
        contractorId,
        documentType,
        docType: documentType,
        documentName: documentName || `${getDocumentTypeLabel(documentType)}.pdf`,
        fileName: documentName || `${documentType}.pdf`,
        originalName: documentName || `${documentType}.pdf`,
        filename: fileNameFromStoragePath,
        storagePath,
        fileUrl,
        downloadURL: fileUrl,
        url: fileUrl,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
        aiStatus: "pending",
        aiValidated: false,
        aiError: null,
        validationError: null,
        status: "uploaded",
        isExpired: false,
      },
    );

    await logActivity({
      contractorId,
      action: `Uploaded ${documentType}`,
      performedBy: user.email?.trim() || user.uid,
    });

    const summary = await recalculateContractorCompliance(getFirebaseAdmin(), contractorId);
    const savedDoc = await getContractorDocument(contractorId, documentType);

    return NextResponse.json(
      {
        document: normalizeDocument(savedDoc.id, (savedDoc.data() ?? {}) as Record<string, unknown>),
        compliance: summary,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error(error);
    return jsonError(error instanceof Error ? error.message : "Failed to save document", 500);
  }
}

export const PATCH = withGovernanceObservation(
  {
    sourceName: "contractor_documents_patch",
    routePath: "/api/contractors/[contractorId]/documents",
    method: "PATCH",
    sourceType: "route",
    sourceClassification: ROUTE_CLASSIFICATIONS.HYBRID,
  },
  async (
    request: NextRequest,
    context: { params: Promise<{ contractorId: string }> },
    governanceContext
  ) => {
  try {
    const user = await requireAuthorizedUser(request);
    const db = getFirebaseAdmin();
    const { contractorId } = await context.params;

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    assertPrivilegedRole(user);

    const body = (await request.json()) as Record<string, unknown>;
    const documentType = parseDocumentType(body.documentType ?? body.documentId);

    if (!documentType) {
      return jsonError("Unsupported documentType", 400);
    }

    const snap = await getContractorDocument(contractorId, documentType);

    if (!snap.exists) {
      return jsonError("Document not found", 404);
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof body.verified === "boolean") {
      emitGovernanceEvent({
        eventId: crypto.randomUUID(),
        eventVersion: "v1",
        occurredAt: new Date().toISOString(),
        category: "legacy_mutation",
        eventType: "direct_verified_patch_branch_observed",
        correlation: {
          correlationId: governanceContext.correlationId,
          requestId: governanceContext.requestId,
        },
        actor: {
          actorId: user.uid,
          actorEmail: user.email?.trim() || null,
          actorRole: user.role,
        },
        source: {
          sourceType: "route",
          sourceName: governanceContext.route.sourceName,
          routePath: governanceContext.route.routePath ?? null,
          method: governanceContext.route.method ?? request.method,
          sourceClassification: governanceContext.route.sourceClassification ?? null,
        },
        entity: {
          entityType: "contractorDocument",
          entityId: documentType,
          contractorId,
          documentType,
        },
        mutation: {
          mutationType: MUTATION_CLASSIFICATIONS.LEGACY_DIRECT_VERIFIED_WRITE,
          mutatedFields: ["verified", "verifiedAt", "verifiedBy"],
        },
        governance: {
          routeClassification: ROUTE_CLASSIFICATIONS.HYBRID,
          sourceClassification: governanceContext.route.sourceClassification ?? null,
          failOpen: true,
        },
      });

      updates.verified = body.verified;
      updates.verifiedAt = body.verified ? new Date().toISOString() : null;
      updates.verifiedBy = body.verified ? user.email?.trim() || "unknown" : null;
    }

    if (typeof body.documentName === "string" && body.documentName.trim()) {
      updates.documentName = body.documentName.trim();
      updates.fileName = body.documentName.trim();
      updates.originalName = body.documentName.trim();
    }

    await upsertContractorDocument(contractorId, documentType, updates);
    const summary = await recalculateContractorCompliance(db, contractorId);
    const updated = await getContractorDocument(contractorId, documentType);

    return NextResponse.json(
      {
        document: normalizeDocument(updated.id, (updated.data() ?? {}) as Record<string, unknown>),
        compliance: summary,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error(error);
    return jsonError(error instanceof Error ? error.message : "Failed to update document", 500);
  }
});
