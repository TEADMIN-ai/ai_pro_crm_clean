import { NextRequest, NextResponse } from "next/server";

import { isSupportedDocumentType } from "@/lib/compliance/contractorCompliance";
import { executeContractorDocumentAnalysis } from "@/lib/documents/executeContractorDocumentAnalysis";
import {
  AuthorizationError,
  assertCanAccessContractor,
  requireAuthorizedUser,
} from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contractorId: string; documentType: string }> }
) {
  try {
    const user = await requireAuthorizedUser(req);
    const { contractorId, documentType } = await params;

    if (!contractorId || !documentType) {
      return jsonError("Missing contractorId or documentType", 400);
    }

    if (!isSupportedDocumentType(documentType)) {
      return jsonError("Unsupported documentType", 400);
    }

    assertCanAccessContractor(user, contractorId);

    const execution = await executeContractorDocumentAnalysis({
      contractorId,
      documentType,
      actorEmail: user.email,
      actorId: user.uid,
    });

    return NextResponse.json(
      {
        contractorId,
        documentType,
        status: "execution_triggered",
        validationStatus: execution.result.status,
        verified: execution.result.verified,
        extractedFields: execution.extractedFields,
        readiness: {
          readinessScore: execution.summary.readinessScore,
          tenderLockStatus: execution.summary.tenderLockStatus,
          isTenderLocked: execution.summary.isTenderLocked,
          readinessUpdatedAt: execution.summary.readinessUpdatedAt,
        },
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
