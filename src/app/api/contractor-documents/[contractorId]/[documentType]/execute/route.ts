import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";

import {
  AuthorizationError,
  assertCanAccessContractor,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { getAdminApp, getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  isSupportedDocumentType,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { recalculateContractorCompliance } from "@/lib/server/recalculateContractorCompliance";
import { verifyStoredContractorDocument } from "@/server/services/documentVerificationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStoragePath(pathValue: string): string | null {
  const trimmed = pathValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("gs://")) {
    const withoutScheme = trimmed.slice("gs://".length);
    const slashIndex = withoutScheme.indexOf("/");
    const resolved = slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";
    return resolved.trim() || null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (!parsed.pathname.includes("/o/")) {
        return null;
      }

      const encodedPath = parsed.pathname.split("/o/")[1] ?? "";
      const decoded = decodeURIComponent(encodedPath);
      return decoded.trim() || null;
    } catch {
      return null;
    }
  }

  return trimmed.replace(/^\/+/, "");
}

function normalizeExtractedFields(fields: Record<string, string | null> | undefined) {
  const extractedFields = { ...(fields ?? {}) };

  if (!("registrationNumber" in extractedFields) && extractedFields.companyRegistrationNumber) {
    extractedFields.registrationNumber = extractedFields.companyRegistrationNumber;
  }

  if (!("registrationNumber" in extractedFields) && extractedFields.employerRegistrationNumber) {
    extractedFields.registrationNumber = extractedFields.employerRegistrationNumber;
  }

  return extractedFields;
}

function buildVerificationPersistence(result: Awaited<ReturnType<typeof verifyStoredContractorDocument>>) {
  const verifiedAt = result.verified ? new Date().toISOString() : null;
  return {
    validationStatus: result.status,
    confidenceScore: result.score,
    missingFields: result.missingFields,
    confidenceNotes: result.confidenceNotes ?? [],
    suggestions: result.suggestions,
    reviewReason: result.reason ?? null,
    validationError: result.status === "FAIL" ? result.reason ?? "Automatic verification failed" : null,
    manualDecisionAvailable: result.status === "REVIEW",
    verified: result.verified,
    verifiedAt,
    verifiedBy: result.verified ? "unknown" : null,
    status: result.status === "PASS" ? "verified" : result.status === "FAIL" ? "invalid" : "uploaded",
  };
}

async function downloadContractorDocumentBuffer(storagePath: string): Promise<Buffer> {
  const storage = getStorage(getAdminApp());
  const [buffer] = await storage.bucket().file(storagePath).download();
  return Buffer.from(buffer);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string; documentType: string }> }
) {
  try {
    const user = await requireAuthorizedUser(req);
    const { contractorId, documentType } = await params;
    const documentPath = `contractors/${contractorId}/documents/${documentType}`;

    console.log("DOCUMENT EXECUTION START");
    console.log("contractorId:", contractorId);
    console.log("documentType:", documentType);
    console.log("documentPath:", documentPath);

    if (!contractorId || !documentType) {
      return jsonError("Missing contractorId or documentType", 400);
    }

    if (!isSupportedDocumentType(documentType)) {
      return jsonError("Unsupported documentType", 400);
    }

    assertCanAccessContractor(user, contractorId);

    const documentRef = getFirebaseAdmin()
      .collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .doc(documentType);

    const documentSnapshot = await documentRef.get();
    if (!documentSnapshot.exists) {
      return jsonError("Document not found", 404);
    }

    const metadata = (documentSnapshot.data() ?? {}) as Record<string, unknown>;
    const storagePathSource =
      asString(metadata.storagePath) ??
      asString(metadata.filePath) ??
      asString(metadata.downloadURL) ??
      asString(metadata.downloadUrl) ??
      asString(metadata.fileUrl) ??
      asString(metadata.url);
    const storagePath = storagePathSource ? normalizeStoragePath(storagePathSource) : null;

    if (!storagePath) {
      return jsonError("Document is missing storagePath", 500);
    }

    let result: Awaited<ReturnType<typeof verifyStoredContractorDocument>>;
    try {
      const buffer = await downloadContractorDocumentBuffer(storagePath);
      result = await verifyStoredContractorDocument(
        buffer,
        (documentType as SupportedDocumentType) || "cipc"
      );
    } catch (error) {
      if (error instanceof Error && error.message === "pdf_extraction_failed") {
        console.error("PDF EXTRACTION FAILED", error);
        return NextResponse.json({ error: "pdf_extraction_failed" }, { status: 500 });
      }

      throw error;
    }
    console.log("AI ANALYSIS RESULT");
    console.log(JSON.stringify(result.extractedFields ?? {}, null, 2));
    console.log("VALIDATION RESULT");
    console.log(
      JSON.stringify(
        {
          status: result.status,
          verified: result.verified,
        },
        null,
        2
      )
    );

    const extractedFields = normalizeExtractedFields(
      result.extractedFields as Record<string, string | null> | undefined
    );
    const analysisTimestamp = Date.now();

    const verificationPersistence = buildVerificationPersistence(result);
    await documentRef.set(
      {
        ...verificationPersistence,
        auditTrail: result.verified
          ? [
              ...(Array.isArray(metadata.auditTrail) ? metadata.auditTrail : []),
              {
                action: "verified",
                by: user.email?.trim() || "unknown",
                at: verificationPersistence.verifiedAt,
              },
            ]
          : metadata.auditTrail,
        verifiedBy: result.verified ? user.email?.trim() || "unknown" : null,
        extractedFields,
        analysisTimestamp,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    await recalculateContractorCompliance(getFirebaseAdmin(), contractorId);

    return NextResponse.json(
      {
        contractorId,
        documentType,
        status: "execution_triggered",
        validationStatus: result.status,
        extractedFields: extractedFields ?? {},
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Contractor document execution failed:", error);
    return jsonError("Failed to execute contractor document analysis", 500);
  }
}
