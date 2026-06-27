import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import {
  generateSupplierRecommendationsForEstimate,
  listCommercialScenariosForEstimate,
  listRecommendationsForEstimate,
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
    const [recommendations, scenarios] = await Promise.all([
      listRecommendationsForEstimate(estimateId),
      listCommercialScenariosForEstimate(estimateId),
    ]);
    return NextResponse.json({ recommendations, scenarios });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_SUPPLIER_RECOMMENDATIONS_GET_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "Supplier recommendations could not be loaded.");
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
    const result = await generateSupplierRecommendationsForEstimate(estimateId, user.uid);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_SUPPLIER_RECOMMENDATIONS_GENERATE_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "Supplier recommendations could not be generated.");
  }
}
