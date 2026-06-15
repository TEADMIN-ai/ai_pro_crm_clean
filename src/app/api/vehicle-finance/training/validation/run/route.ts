export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { listVehicleFinanceTrainingDocuments } from "@/lib/vehicle-finance/training";
import { runVehicleFinanceTrainingValidation } from "@/lib/vehicle-finance/training";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const body = (await request.json().catch(() => null)) as { documentId?: string } | null;
    const documentId = typeof body?.documentId === "string" && body.documentId.trim().length > 0 ? body.documentId.trim() : undefined;
    const documents = await listVehicleFinanceTrainingDocuments();
    console.log("[vehicle-finance-training] documentsFound", {
      documentId: documentId ?? null,
      documentsFound: documents.length,
    });

    if (documentId) {
      const summary = await runVehicleFinanceTrainingValidation(documentId);
      return NextResponse.json(summary, { status: 202 });
    }

    if (!documents.length) {
      console.log("[vehicle-finance-training] validationFailures", {
        documentId: documentId ?? null,
        validationFailures: 0,
        reason: "empty_dataset",
      });
      return NextResponse.json({
        processed: 0,
        results: [],
        message: "No training documents available.",
      });
    }

    return NextResponse.json({
      processed: 0,
      queuedDocumentIds: documents.map((document) => document.documentId),
      documentCount: documents.length,
      message: "Use /api/vehicle-finance/training/documents/{documentId}/validate for sequential validation.",
    }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[vehicle-finance-training] validation run failed", error);
    return NextResponse.json({ error: "Vehicle finance training validation failed" }, { status: 500 });
  }
}
