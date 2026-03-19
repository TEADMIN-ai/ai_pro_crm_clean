import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminApp, getFirebaseAdmin } from "@/lib/firebase/admin";
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
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { verifyStoredContractorDocument } from "@/server/services/documentVerificationService";
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
    status: typeof data.status === "string" ? data.status : undefined,
  };

  return {
    ...document,
    status: resolveContractorDocumentStatus(document),
  };
}

function buildVerificationPersistence(result: Awaited<ReturnType<typeof verifyStoredContractorDocument>>) {
  return {
    validationStatus: result.status,
    confidenceScore: result.score,
    missingFields: result.missingFields,
    extractedFields: result.extractedFields,
    confidenceNotes: result.confidenceNotes ?? [],
    suggestions: result.suggestions,
    reviewReason: result.reason ?? null,
    validationError: result.status === "FAIL" ? result.reason ?? "Automatic verification failed" : null,
    manualDecisionAvailable: result.status === "REVIEW",
    verified: result.verified,
    verifiedAt: result.verified ? new Date() : null,
    status: result.status === "PASS" ? "verified" : result.status === "FAIL" ? "invalid" : "uploaded",
    analysisTimestamp: Date.now(),
    updatedAt: new Date(),
  };
}

function parseDocumentType(value: unknown): SupportedDocumentType | null {
  const type = getString(value);
  return isSupportedDocumentType(type) ? type : null;
}

function isValidStoragePath(contractorId: string, documentType: SupportedDocumentType, storagePath: string): boolean {
  return storagePath === `contractors/${contractorId}/${documentType}.pdf`;
}

async function downloadContractorDocumentBuffer(storagePath: string): Promise<Buffer> {
  const storage = getStorage(getAdminApp());
  const [buffer] = await storage.bucket().file(storagePath).download();
  return Buffer.from(buffer);
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
    const fileUrl = getString(body.fileUrl || body.downloadURL || body.url);

    if (!documentType) {
      return jsonError("Unsupported documentType", 400);
    }

    if (!storagePath || !fileUrl) {
      return jsonError("Missing storagePath or fileUrl", 400);
    }

    if (!isValidStoragePath(contractorId, documentType, storagePath)) {
      return jsonError("Invalid storagePath", 400);
    }

    if (!/^https?:\/\//i.test(fileUrl)) {
      return jsonError("Invalid fileUrl", 400);
    }

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
        filename: `${documentType}.pdf`,
        storagePath,
        fileUrl,
        downloadURL: fileUrl,
        url: fileUrl,
        uploadedAt: now,
        createdAt: now,
        updatedAt: now,
        verified: false,
        verifiedAt: null,
        validationError: null,
        status: "uploaded",
      },
    );

    try {
      console.log("Document verification running", {
        contractorId,
        documentType,
      });

      const buffer = await downloadContractorDocumentBuffer(storagePath);
      const verificationResult = await verifyStoredContractorDocument(buffer, documentType);
      await upsertContractorDocument(contractorId, documentType, buildVerificationPersistence(verificationResult));
    } catch (error) {
      console.error("Document verification failed", error);
    }

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> }
) {
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
      updates.verified = body.verified;
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
}
