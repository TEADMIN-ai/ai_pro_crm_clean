import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { executeContractorDocumentAnalysis } from "@/lib/documents/executeContractorDocumentAnalysis";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { recordAuditLog } from "@/server/services/auditLogService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseLimit(request: NextRequest): number {
  const raw = request.nextUrl.searchParams.get("limit");
  const parsed = raw ? Number(raw) : 25;
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, Math.trunc(parsed))) : 25;
}

async function findFailedDocuments(limit: number) {
  const db = getFirebaseAdmin();
  const contractors = await db.collection("contractors").limit(500).get();
  const failed: Array<{ contractorId: string; documentType: string }> = [];

  for (const contractor of contractors.docs) {
    if (failed.length >= limit) break;

    const documents = await contractor.ref.collection("documents").get();
    for (const document of documents.docs) {
      if (failed.length >= limit) break;
      const data = (document.data() ?? {}) as Record<string, unknown>;
      const extractionSource = asString(data.extractionSource);
      const extractedTextLength =
        typeof data.extractedTextLength === "number" && Number.isFinite(data.extractedTextLength)
          ? data.extractedTextLength
          : null;

      if (extractionSource === "EMPTY" || extractedTextLength === 0) {
        failed.push({ contractorId: contractor.id, documentType: document.id });
      }
    }
  }

  return failed;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    if (user.role !== "admin") {
      throw new AuthorizationError("unauthorized", 403);
    }

    const limit = parseLimit(request);
    const failedDocuments = await findFailedDocuments(limit);
    const results: Array<{
      contractorId: string;
      documentType: string;
      success: boolean;
      extractionSource?: string | null;
      extractedTextLength?: number;
      error?: string;
    }> = [];

    for (const document of failedDocuments) {
      try {
        const execution = await executeContractorDocumentAnalysis({
          contractorId: document.contractorId,
          documentType: document.documentType,
          actorEmail: user.email,
          actorId: user.uid,
          writeActivity: false,
        });

        await recordAuditLog({
          userId: user.uid,
          action: "FAILED_DOCUMENT_REPROCESSED",
          entityType: "document",
          entityId: document.documentType,
          metadata: {
            contractorId: document.contractorId,
            documentType: document.documentType,
            extractionSource: execution.result.extractionSource ?? null,
            extractedTextLength: execution.result.extractedTextLength ?? 0,
          },
        });

        results.push({
          contractorId: document.contractorId,
          documentType: document.documentType,
          success: true,
          extractionSource: execution.result.extractionSource ?? null,
          extractedTextLength: execution.result.extractedTextLength ?? 0,
        });
      } catch (error) {
        results.push({
          contractorId: document.contractorId,
          documentType: document.documentType,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        scanned: failedDocuments.length,
        reprocessed: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
        results,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("[bulk-reprocess-failed-documents] failed", error);
    return jsonError("Failed to reprocess failed documents", 500);
  }
}
