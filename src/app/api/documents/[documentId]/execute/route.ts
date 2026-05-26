import { NextRequest, NextResponse } from "next/server";

import { normalizeSupportedDocumentType } from "@/lib/compliance/contractorCompliance";
import { executeContractorDocumentAnalysis } from "@/lib/documents/executeContractorDocumentAnalysis";
import {
  AuthorizationError,
  assertCanAccessContractor,
  requireAuthorizedUser,
} from "@/lib/server/authz";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuthorizedUser(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const url = new URL(req.url);
    const { documentId } = await context.params;
    const contractorId = asString(body?.contractorId) || url.searchParams.get("contractorId")?.trim() || "";
    const documentType = normalizeSupportedDocumentType(
      asString(body?.documentType) || url.searchParams.get("documentType")
    );

    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    if (!contractorId || !documentType) {
      return NextResponse.json(
        { error: "contractorId and supported documentType are required" },
        { status: 400 }
      );
    }

    assertCanAccessContractor(user, contractorId);

    const execution = await executeContractorDocumentAnalysis({
      contractorId,
      documentType,
      actorEmail: user.email,
      actorId: user.uid,
    });

    return NextResponse.json({
      success: true,
      contractorId,
      documentId,
      documentType,
      verificationResult: execution.result.verified,
      validationStatus: execution.result.status,
      extractedFields: execution.extractedFields,
      readiness: {
        readinessScore: execution.summary.readinessScore,
        tenderLockStatus: execution.summary.tenderLockStatus,
        isTenderLocked: execution.summary.isTenderLocked,
        readinessUpdatedAt: execution.summary.readinessUpdatedAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Document execution failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
