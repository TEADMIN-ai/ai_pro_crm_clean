import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminApp, getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  AuthorizationError,
  assertCanAccessContractor,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import {
  getDocumentTypeLabel,
  isSupportedDocumentType,
  resolveContractorDocumentStatus,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { aiExtractDocument } from "@/lib/verification/aiExtract";
import { extractDocumentData } from "@/lib/verification/extractData";
import { validateDocument } from "@/lib/verification/validateDocument";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { verifyStoredContractorDocument } from "@/server/services/documentVerificationService";
import type { ContractorDocument } from "@/types/document";

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

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    const formData = await request.formData();
    const uploadedFile = formData.get("file");
    const contractorId = getString(formData.get("contractorId"));
    const rawDocumentType = getString(formData.get("documentType"));

    if (!(uploadedFile instanceof File)) {
      return jsonError("Missing file", 400);
    }

    if (!contractorId) {
      return jsonError("Missing contractorId", 400);
    }

    assertCanAccessContractor(user, contractorId);

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
    const storagePath = `contractors/${contractorId}/${documentType}.pdf`;
    const bucket = getStorage(getAdminApp()).bucket();
    const file = bucket.file(storagePath);

    await file.save(fileBuffer, {
      metadata: {
        contentType: uploadedFile.type || "application/pdf",
        metadata: {
          contractorId,
          documentType,
          originalName: sanitizeFilename(uploadedFile.name),
          uploadedByUid: user.uid,
        },
      },
      resumable: false,
    });

    const [fileUrl] = await file.getSignedUrl({
      action: "read",
      expires: "2100-01-01",
    });

    const db = getFirebaseAdmin();
    const documentRef = db
      .collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .doc();
    const documentId = documentRef.id;
    const now = new Date();
    const documentName = uploadedFile.name || `${getDocumentTypeLabel(documentType)}.pdf`;
    const extracted = await extractDocumentData(fileBuffer);
    const aiResult = await aiExtractDocument(extracted.rawText);
    const validation = validateDocument(extracted, documentType);
    const isExpired =
      aiResult.expiryDate &&
      new Date(aiResult.expiryDate) < new Date();

    const finalVerified =
      validation.isValid &&
      aiResult.riskLevel !== "high" &&
      !isExpired &&
      aiResult?.issues?.length === 0;

    console.log("SYSTEM CHECK:", {
      verified: finalVerified,
      risk: aiResult?.riskLevel,
      issues: aiResult?.issues,
    });

    console.log("FINAL VERDICT:", {
      isValid: validation.isValid,
      risk: aiResult.riskLevel,
      expired: isExpired,
      issues: aiResult.issues,
      finalVerified,
    });

    await documentRef.set({
      id: documentId,
      contractorId,
      documentType,
      docType: documentType,
      documentName,
      fileName: documentName,
      originalName: uploadedFile.name,
      filename: `${documentType}.pdf`,
      storagePath,
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
      aiData: aiResult,
      riskLevel: aiResult.riskLevel || "unknown",
      aiIssues: aiResult.issues || [],
      expiryDate: aiResult.expiryDate ? Date.parse(aiResult.expiryDate) || null : null,
      extractedText: extracted.rawText,
      extractedTextLength: extracted.rawText.length,
      status: "uploaded",
    });

    try {
      const verificationResult = await verifyStoredContractorDocument(fileBuffer, documentType);
      const existingDocument = (await documentRef.get()).data() as
        | Record<string, unknown>
        | undefined;

      await documentRef.set(
        {
          ...buildVerificationPersistence(verificationResult, user, existingDocument),
          verified: finalVerified && verificationResult.verified,
          issues: validation.issues,
          aiData: aiResult,
          riskLevel: aiResult.riskLevel || "unknown",
          aiIssues: aiResult.issues || [],
          expiryDate: aiResult.expiryDate ? Date.parse(aiResult.expiryDate) || null : null,
          extractedText: extracted.rawText,
          extractedTextLength: extracted.rawText.length,
        },
        { merge: true }
      );
    } catch (verificationError) {
      console.error("Document verification failed", verificationError);
    }

    const compliance = await recalculateContractorCompliance(getFirebaseAdmin(), contractorId);
    const savedDoc = await documentRef.get();

    return NextResponse.json(
      {
        success: true,
        documentId: documentRef.id,
        document: normalizeDocument(savedDoc.id, (savedDoc.data() ?? {}) as Record<string, unknown>),
        compliance,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Document upload failed", error);
    return jsonError(error instanceof Error ? error.message : "Upload failed", 500);
  }
}
