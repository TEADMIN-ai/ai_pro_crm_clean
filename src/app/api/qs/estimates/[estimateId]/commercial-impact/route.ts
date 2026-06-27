import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import {
  generateCommercialScenariosForEstimate,
  listCommercialScenariosForEstimate,
} from "@/lib/qs/supplier-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ estimateId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const { estimateId } = await context.params;
    const scenarios = await listCommercialScenariosForEstimate(estimateId);
    return NextResponse.json({ scenarios });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_COMMERCIAL_IMPACT_GET_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "Commercial impact scenarios could not be loaded.");
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ estimateId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const { estimateId } = await context.params;
    const scenarios = await generateCommercialScenariosForEstimate(estimateId, user.uid);
    return NextResponse.json({ scenarios });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_COMMERCIAL_IMPACT_GENERATE_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "Commercial impact scenarios could not be generated.");
  }
}
