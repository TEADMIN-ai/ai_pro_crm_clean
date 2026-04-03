import { NextRequest, NextResponse } from "next/server";
import {
  getDocumentTypeLabel,
  isSupportedDocumentType,
  resolveContractorDocumentStatus,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebaseAdmin";
import { validateDocument as validateAiDocument } from "@/lib/services/aiValidationService";
import { extractText } from "@/lib/services/pdfService";
import { aiExtractDocument } from "@/lib/verification/aiExtract";
import { extractDocumentData } from "@/lib/verification/extractData";
import { validateDocument as validateExtractedDocument } from "@/lib/verification/validateDocument";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { verifyStoredContractorDocument } from "@/server/services/documentVerificationService";
import {
  getContractorDocument,
  upsertContractorDocument,
} from "@/server/services/contractorService";
import type { ContractorDocument } from "@/types/document";

export const runtime = "nodejs";

type AppUserRecord = {
  contractorId?: unknown;
  email?: unknown;
  role?: unknown;
};

class UploadAuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "UploadAuthorizationError";
  }
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function sanitizeFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "document.pdf";
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
      data.aiStatus === "valid" || data.aiStatus === "warning" || data.aiStatus === "invalid"
        ? data.aiStatus
        : undefined,
    aiSuggestion: typeof data.aiSuggestion === "string" ? data.aiSuggestion : undefined,
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
    extractedText: typeof data.extractedText === "string" ? data.extractedText : undefined,
    extractedTextLength:
      typeof data.extractedTextLength === "number" ? data.extractedTextLength : undefined,
    status: typeof data.status === "string" ? data.status : undefined,
  };

  return {
    ...document,
    status: resolveContractorDocumentStatus(document),
  };
}

function buildVerificationPersistence(
  result: Awaited<ReturnType<typeof verifyStoredContractorDocument>>,
  user: { email?: string },
  existingDocument?: Record<string, unknown>
) {
  const verifiedAt = result.verified ? new Date().toISOString() : null;
  const verifiedBy = result.verified ? user.email?.trim() || "unknown" : null;
  const auditTrailEntry = result.verified
    ? {
        action: "verified",
        by: user.email?.trim() || "unknown",
        at: verifiedAt,
      }
    : null;

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
    verifiedAt,
    verifiedBy,
    auditTrail: auditTrailEntry
      ? [...(Array.isArray(existingDocument?.auditTrail) ? existingDocument.auditTrail : []), auditTrailEntry]
      : existingDocument?.auditTrail,
    status: result.status === "PASS" ? "verified" : result.status === "FAIL" ? "invalid" : "uploaded",
    analysisTimestamp: Date.now(),
    updatedAt: new Date(),
  };
}

function inferDocumentType(fileName: string): SupportedDocumentType | null {
  const value = fileName.toLowerCase();

  if (value.includes("cipc") || value.includes("registration")) return "cipc";
  if (value.includes("bbbee") || value.includes("b-bbee") || value.includes("bee")) return "bbbee";
  if (value.includes("tax")) return "taxClearance";
  if (value.includes("coida") || value.includes("compensation")) return "coida";
  if (value.includes("bank")) return "bankConfirmation";

  return null;
}

async function authenticateRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    throw new UploadAuthorizationError("Unauthorized", 401);
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new UploadAuthorizationError("Unauthorized", 401);
  }

  let decoded;

  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    throw new UploadAuthorizationError("Unauthorized", 401);
  }

  const userDoc = await adminDb.collection("users").doc(decoded.uid).get();

  if (!userDoc.exists) {
    throw new UploadAuthorizationError("User not found", 404);
  }

  const userData = (userDoc.data() ?? {}) as AppUserRecord;
  return {
    uid: decoded.uid,
    email:
      typeof decoded.email === "string"
        ? decoded.email
        : typeof userData.email === "string"
          ? userData.email
          : undefined,
    role: typeof userData.role === "string" ? userData.role.trim().toLowerCase() : "guest",
    contractorId: getString(userData.contractorId),
  };
}

function resolveTargetContractorId(
  user: { contractorId?: string; role: string },
  requestedContractorId: string
) {
  const isPrivileged = user.role === "admin" || user.role === "manager" || user.role === "staff";

  if (isPrivileged) {
    return requestedContractorId || user.contractorId || "";
  }

  if (!user.contractorId) {
    return "";
  }

  if (requestedContractorId && requestedContractorId !== user.contractorId) {
    throw new UploadAuthorizationError("You cannot upload documents for another contractor", 403);
  }

  return user.contractorId;
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    const formData = await request.formData();
    const uploadedFile = formData.get("file");
    const requestedContractorId = getString(formData.get("contractorId"));
    const rawDocumentType = getString(formData.get("documentType"));

    if (!(uploadedFile instanceof File)) {
      return jsonError("No file provided", 400);
    }

    const contractorId = resolveTargetContractorId(user, requestedContractorId);

    if (!contractorId) {
      return jsonError("No contractor linked", 403);
    }

    if (!uploadedFile.name.toLowerCase().endsWith(".pdf")) {
      return jsonError("Only PDF files are allowed", 400);
    }

    if (uploadedFile.type && uploadedFile.type !== "application/pdf") {
      return jsonError("Invalid file type. Upload a PDF document.", 400);
    }

    const documentType = isSupportedDocumentType(rawDocumentType)
      ? rawDocumentType
      : inferDocumentType(uploadedFile.name);

    if (!documentType) {
      return jsonError("Unsupported or missing documentType", 400);
    }

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const safeOriginalName = sanitizeFilename(uploadedFile.name);
    const fileName = `${Date.now()}-${safeOriginalName}`;
    const filePath = `contractors/${contractorId}/documents/${fileName}`;
    const storageFile = adminStorage.bucket().file(filePath);

    await storageFile.save(fileBuffer, {
      metadata: {
        contentType: uploadedFile.type || "application/pdf",
        metadata: {
          contractorId,
          documentType,
          originalName: safeOriginalName,
          uploadedByUid: user.uid,
        },
      },
      resumable: false,
    });

    const [fileUrl] = await storageFile.getSignedUrl({
      action: "read",
      expires: "2100-01-01",
    });

    const now = new Date();
    const documentName = uploadedFile.name || `${getDocumentTypeLabel(documentType)}.pdf`;
    const extractedText = await extractText(fileBuffer);
    const aiValidation = await validateAiDocument(extractedText, documentType);
    const extracted = await extractDocumentData(fileBuffer);
    const aiResult = await aiExtractDocument(extracted.rawText);
    const validation = validateExtractedDocument(extracted, documentType);
    const isExpired = aiResult.expiryDate ? new Date(aiResult.expiryDate) < new Date() : false;
    const normalizedExtractedText = extractedText || extracted.rawText;
    const combinedAiIssues = Array.from(
      new Set([...(aiValidation.issues || []), ...(aiResult.issues || [])])
    );

    const finalVerified =
      validation.isValid &&
      aiResult.riskLevel !== "high" &&
      !isExpired &&
      aiResult?.issues?.length === 0;

    await adminDb.collection("documents").add({
      contractorId,
      documentType,
      documentName,
      fileName,
      filePath,
      storagePath: filePath,
      contentType: uploadedFile.type || "application/pdf",
      size: uploadedFile.size,
      uploadedAt: Date.now(),
      uploadedBy: user.uid,
      status: "pending",
      aiStatus: aiValidation.status,
      aiIssues: aiValidation.issues,
      aiSuggestion: aiValidation.suggestion,
    });

    await upsertContractorDocument(contractorId, documentType, {
      contractorId,
      documentType,
      docType: documentType,
      documentName,
      fileName: documentName,
      originalName: uploadedFile.name,
      filename: fileName,
      storagePath: filePath,
      filePath,
      fileUrl,
      downloadURL: fileUrl,
      url: fileUrl,
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
      verified: finalVerified,
      verifiedAt: null,
      validationError: null,
      issues: validation.issues,
      aiStatus: aiValidation.status,
      aiData: aiResult,
      riskLevel: aiResult.riskLevel || "unknown",
      aiIssues: combinedAiIssues,
      aiSuggestion: aiValidation.suggestion,
      expiryDate: aiResult.expiryDate ? Date.parse(aiResult.expiryDate) || null : null,
      extractedText: normalizedExtractedText,
      extractedTextLength: normalizedExtractedText.length,
      status: "uploaded",
    });

    try {
      const verificationResult = await verifyStoredContractorDocument(fileBuffer, documentType);
      const existingDocument = (await getContractorDocument(contractorId, documentType)).data() as
        | Record<string, unknown>
        | undefined;

      await upsertContractorDocument(
        contractorId,
        documentType,
        {
          ...buildVerificationPersistence(verificationResult, user, existingDocument),
          verified: finalVerified && verificationResult.verified,
          issues: validation.issues,
          aiStatus: aiValidation.status,
          aiData: aiResult,
          riskLevel: aiResult.riskLevel || "unknown",
          aiIssues: combinedAiIssues,
          aiSuggestion: aiValidation.suggestion,
          expiryDate: aiResult.expiryDate ? Date.parse(aiResult.expiryDate) || null : null,
          extractedText: normalizedExtractedText,
          extractedTextLength: normalizedExtractedText.length,
        }
      );
    } catch (verificationError) {
      console.error("Document verification failed", verificationError);
    }

    const compliance = await recalculateContractorCompliance(adminDb, contractorId);
    const savedDoc = await getContractorDocument(contractorId, documentType);

    return NextResponse.json(
      {
        success: true,
        filePath,
        document: normalizeDocument(savedDoc.id, (savedDoc.data() ?? {}) as Record<string, unknown>),
        compliance,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof UploadAuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Document upload failed", error);
    return jsonError(error instanceof Error ? error.message : "Upload failed", 500);
  }
}
