import { NextRequest, NextResponse } from "next/server";
import { createEstimateFromBoq, listEstimates } from "@/lib/qs/estimating";
import { AuthorizationError, requireAuthorizedUser, type AuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function assertQsEstimatingAccess(user: AuthorizedUser) {
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "staff") {
    throw new AuthorizationError("unauthorized", 403);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsEstimatingAccess(user);

    const estimates = await listEstimates(100);
    return NextResponse.json({ estimates });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("[QS_ESTIMATES_LIST_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS estimates could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsEstimatingAccess(user);

    const body = (await request.json()) as { boqDocumentId?: unknown; assumptions?: unknown };
    const boqDocumentId = typeof body.boqDocumentId === "string" ? body.boqDocumentId.trim() : "";
    if (!boqDocumentId) {
      return jsonError("A source BOQ document ID is required.", 400);
    }

    const estimate = await createEstimateFromBoq({
      boqDocumentId,
      createdByUid: user.uid,
      config: body.assumptions && typeof body.assumptions === "object" ? body.assumptions : undefined,
    });

    return NextResponse.json({ estimate });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("[QS_ESTIMATE_CREATE_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS estimate could not be created.");
  }
}
