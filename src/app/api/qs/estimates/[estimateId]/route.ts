import { NextRequest, NextResponse } from "next/server";
import { getEstimate, listEstimateHistory, recalculateEstimate, updateEstimateConfig } from "@/lib/qs/estimating";
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ estimateId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsEstimatingAccess(user);
    const { estimateId } = await context.params;
    const estimate = await getEstimate(estimateId);
    if (!estimate) {
      return jsonError("QS estimate not found.", 404);
    }

    const history = await listEstimateHistory(estimateId);
    return NextResponse.json({ estimate, history });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("[QS_ESTIMATE_GET_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS estimate could not be loaded.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ estimateId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsEstimatingAccess(user);
    const { estimateId } = await context.params;
    const body = (await request.json()) as { assumptions?: unknown };
    const assumptions = body.assumptions && typeof body.assumptions === "object" ? body.assumptions : {};
    const estimate = await updateEstimateConfig(estimateId, assumptions, user.uid);
    return NextResponse.json({ estimate });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("[QS_ESTIMATE_UPDATE_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS estimate assumptions could not be updated.");
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ estimateId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsEstimatingAccess(user);
    const { estimateId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { action?: unknown };
    const action = typeof body.action === "string" ? body.action : "recalculate";

    if (action !== "recalculate") {
      return jsonError("Unsupported QS estimate action.", 400);
    }

    const estimate = await recalculateEstimate(estimateId, user.uid);
    return NextResponse.json({ estimate });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("[QS_ESTIMATE_RECALCULATE_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS estimate could not be recalculated.");
  }
}
