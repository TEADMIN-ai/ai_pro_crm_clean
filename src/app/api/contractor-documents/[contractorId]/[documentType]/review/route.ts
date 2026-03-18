import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationError,
  assertCanAccessContractor,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { applyManualDocumentVerification, type ManualVerificationAction } from "@/server/services/manualDocumentVerificationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseAction(value: unknown): ManualVerificationAction | null {
  if (value === "approve" || value === "reject" || value === "request_reupload") {
    return value;
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractorId: string; documentType: string }> }
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId, documentType } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = parseAction(body.action);
    const reviewReason = typeof body.reviewReason === "string" ? body.reviewReason.trim() : undefined;

    if (!contractorId || !documentType) {
      return jsonError("Missing contractorId or documentType", 400);
    }

    if (!action) {
      return jsonError("Invalid manual verification action", 400);
    }

    assertCanAccessContractor(user, contractorId);
    assertPrivilegedRole(user);

    const document = await applyManualDocumentVerification({
      contractorId,
      documentType,
      action,
      actor: user,
      reviewReason,
    });

    return NextResponse.json(
      {
        success: true,
        document,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof Error && error.message === "Document not found") {
      return jsonError(error.message, 404);
    }

    console.error("Manual document review failed:", error);
    return jsonError("Failed to apply manual document review", 500);
  }
}
