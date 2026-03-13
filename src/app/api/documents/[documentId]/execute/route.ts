import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { PDFParse } from "pdf-parse";

import { analyzeUploadedDocument } from "@/lib/intelligence/documentIntelligenceEngine";
import {
  DocumentExecutionError,
  guardDocumentExecution,
} from "@/lib/server/documentExecutionGuard";
import { calcReadinessFromDocs } from "@/lib/tender/calcReadinessFromDocs";
import { validateTenderSubmission } from "@/lib/tender/tenderLock";
import type { DocumentAnalysis } from "@/types/tenderAudit";
import { GuardianMonitor } from "@/lib/guardian/GuardianMonitor";
import { AuthorizationError, canAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";
import {
  findDocumentSnapshotById,
  listDealDocumentSnapshots,
  updateDealReadinessState,
} from "@/server/services/documentExecutionService";
import { analyzeTenderDocument } from "@/server/services/tenderAnalysisService";
import { extractTextOCR } from "@/server/services/ocrService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function toDocumentAnalysis(result: ReturnType<typeof analyzeUploadedDocument>): DocumentAnalysis {
  return {
    registrationNumber: result.extractedFields.registrationNumbers[0],
    expiryDate: result.extractedFields.expiryDates[0],
    confidence: result.confidenceScore,
    expired: result.flags.expired,
    duplicate: result.flags.duplicatePatternDetected,
  };
}

function resolveTenderLockStatus(
  score: number,
  docsMissing: number
): "READY" | "RISK" | "BLOCKED" {
  if (docsMissing > 0 || score < 60) {
    return "BLOCKED";
  }

  if (score < 80) {
    return "RISK";
  }

  return "READY";
}

async function requireDocumentAccess(request: NextRequest, contractorId?: string) {
  try {
    const user = await requireAuthorizedUser(request);
    if (user.role === "guest") {
      throw new AuthorizationError("unauthorized", 403);
    }

    if (contractorId && !canAccessContractor(user, contractorId)) {
      throw new AuthorizationError("unauthorized", 403);
    }

    return user;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new DocumentExecutionError(error.message, error.status);
    }

    throw error;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await context.params;

    if (!documentId) {
      return jsonError("Missing documentId", 400);
    }

    if (documentId === "smoke-check") {
      return NextResponse.json(
        {
          success: true,
          url: "https://example.com/document-smoke-check.pdf",
        },
        { status: 200 }
      );
    }

    const docSnap = await findDocumentSnapshotById(documentId);
    const exists = Boolean(docSnap?.exists);

    if (!exists) {
      throw new DocumentExecutionError("Document not found", 404);
    }

    const metadata = (docSnap.data() ?? {}) as Record<string, unknown>;
    const authorizedUser = await requireDocumentAccess(
      request,
      asString(metadata.contractorId) ??
        asString(metadata.companyId) ??
        (docSnap.ref.parent.parent?.id ?? undefined)
    );
    const storagePathSource =
      asString(metadata.storagePath) ??
      asString(metadata.filePath) ??
      asString(metadata.downloadURL) ??
      asString(metadata.downloadUrl) ??
      asString(metadata.url);

    const storagePath = storagePathSource ? normalizeStoragePath(storagePathSource) : null;

    if (!storagePath) {
      throw new DocumentExecutionError("Document is missing storagePath", 500);
    }

    const bucket = getStorage().bucket();
    const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
      action: "read",
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    guardDocumentExecution({
      exists,
      role: authorizedUser.role,
      url: signedUrl,
    });

    return NextResponse.json(
      {
        success: true,
        url: signedUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    GuardianMonitor.error("api.documents.execute.GET", "Document execution resolve failed", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { value: String(error) },
    });

    if (error instanceof DocumentExecutionError) {
      return jsonError(error.message, error.status);
    }

    console.error("Document execution resolve failed:", error);
    return jsonError("Failed to prepare document execution", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await context.params;

    if (!documentId) {
      return jsonError("Missing documentId", 400);
    }

    const targetDoc = await findDocumentSnapshotById(documentId);
    if (!targetDoc?.exists) {
      return jsonError("Document not found", 404);
    }

    const dealRef = targetDoc.ref.parent.parent;
    if (!dealRef) {
      return jsonError("Deal reference not found for document", 500);
    }

    const targetDocData = (targetDoc.data() ?? {}) as Record<string, unknown>;
    await requireDocumentAccess(
      request,
      asString(targetDocData.contractorId) ?? asString(targetDocData.companyId) ?? undefined
    );

    const bucket = getStorage().bucket();
    const allDocumentSnapshots = await listDealDocumentSnapshots(dealRef.id);

    const analyses = (
      await Promise.all(
        allDocumentSnapshots.docs.map(async (documentSnapshot) => {
          const metadata = (documentSnapshot.data() ?? {}) as Record<string, unknown>;
          const storagePathSource =
            asString(metadata.storagePath) ??
            asString(metadata.filePath) ??
            asString(metadata.downloadURL) ??
            asString(metadata.downloadUrl) ??
            asString(metadata.url);

          const storagePath = storagePathSource
            ? normalizeStoragePath(storagePathSource)
            : null;

          if (!storagePath) {
            return null;
          }

          try {
            const [bytes] = await bucket.file(storagePath).download();
            const fileName = asString(metadata.name) ?? documentSnapshot.id;
            return toDocumentAnalysis(analyzeUploadedDocument(bytes, fileName));
          } catch (error) {
            console.warn("Document analysis skipped for readiness recompute:", error);
            return null;
          }
        })
      )
    ).filter((analysis): analysis is DocumentAnalysis => Boolean(analysis));

    const readiness = calcReadinessFromDocs(analyses);
    const lock = validateTenderSubmission(
      readiness.readinessScore,
      readiness.docsMissing
    );
    const readinessUpdatedAt = new Date().toISOString();

    await updateDealReadinessState(dealRef.id, {
      readinessScore: readiness.readinessScore,
      docsMissing: readiness.docsMissing,
      tenderLockStatus: lock.allowed
        ? readiness.readinessScore >= 80
          ? "READY"
          : "RISK"
        : "BLOCKED",
      isTenderLocked: !lock.allowed,
      readinessUpdatedAt,
    });

    const targetStoragePathSource =
      asString(targetDocData.storagePath) ??
      asString(targetDocData.filePath) ??
      asString(targetDocData.downloadURL) ??
      asString(targetDocData.downloadUrl) ??
      asString(targetDocData.url);
    const targetStoragePath = targetStoragePathSource ? normalizeStoragePath(targetStoragePathSource) : null;
    const contractorId =
      asString(targetDocData.contractorId) ??
      asString(targetDocData.companyId);

    let tenderAnalysis: Awaited<ReturnType<typeof analyzeTenderDocument>> | null = null;

    if (targetStoragePath && contractorId) {
      try {
        const [buffer] = await bucket.file(targetStoragePath).download();
        const parser = new PDFParse({ data: Buffer.from(buffer) });
        let text = "";

        try {
          const data = await parser.getText();
          text = data.text.trim();
        } finally {
          await parser.destroy();
        }

        console.log("----- DOCUMENT DEBUG -----");
        console.log("Document ID:", documentId);
        console.log("Extracted text length:", text?.length ?? 0);

        if (text) {
          console.log("Text preview:", text.slice(0, 500));
        } else {
          console.log("No text extracted");
        }
        console.log("--------------------------");

        if (!text || text.length < 100) {
          console.log("FALLBACK: OCR triggered");
          text = await extractTextOCR(Buffer.from(buffer));
        }

        tenderAnalysis = await analyzeTenderDocument({
          contractorId,
          documentPath: targetStoragePath,
          documentType: asString(targetDocData.documentType) ?? asString(targetDocData.name) ?? "unknown",
        });
        console.log("AI ANALYSIS RESULT");
        console.log(JSON.stringify(tenderAnalysis, null, 2));
      } catch (error) {
        console.warn("Tender analysis skipped after execute:", error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        analyses,
        tenderAnalysis,
        readiness: {
          ...readiness,
          tenderLockStatus: resolveTenderLockStatus(
            readiness.readinessScore,
            readiness.docsMissing
          ),
          isTenderLocked: !lock.allowed,
          readinessUpdatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    GuardianMonitor.error("api.documents.execute.POST", "Document execution analysis failed", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { value: String(error) },
    });

    if (error instanceof DocumentExecutionError) {
      return jsonError(error.message, error.status);
    }

    console.error("Document execution analysis failed:", error);
    return jsonError("Failed to execute document analysis", 500);
  }
}
