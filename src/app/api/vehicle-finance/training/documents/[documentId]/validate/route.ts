export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { listVehicleFinanceTrainingDocuments, runVehicleFinanceTrainingValidationForDocument } from "@/lib/vehicle-finance/training";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const { documentId } = await context.params;
    const normalizedDocumentId = documentId.trim();
    if (!normalizedDocumentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const documents = await listVehicleFinanceTrainingDocuments();
    const document = documents.find((item) => item.documentId === normalizedDocumentId);
    console.log("[vehicle-finance-training] validationStarted", {
      documentId: normalizedDocumentId,
      documentsFound: documents.length,
      documentCategory: document?.category ?? null,
    });

    if (!document) {
      console.log("[vehicle-finance-training] validationFailed", {
        documentId: normalizedDocumentId,
        documentCategory: null,
        reason: "document_not_found",
      });
      return NextResponse.json({ error: "Training document not found" }, { status: 404 });
    }

    const result = await runVehicleFinanceTrainingValidationForDocument(document);

    console.log("[vehicle-finance-training] validationCompleted", {
      documentId: normalizedDocumentId,
      documentCategory: document.category,
      pdfTextLength: result.pdfTextLength ?? 0,
      openAiTextLength: result.openAiOcrTextLength ?? 0,
      tesseractTextLength: result.tesseractOcrTextLength ?? 0,
      finalTextLength: result.extractedTextLength,
      confidenceScore: result.confidenceScore,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[vehicle-finance-training] document validation failed", error);
    return NextResponse.json({ error: "Vehicle finance training validation failed" }, { status: 500 });
  }
}

