import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import { buildCommercialDashboardSummary } from "@/lib/qs/commercial-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const summary = await buildCommercialDashboardSummary();
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_COMMERCIAL_INTELLIGENCE_SUMMARY_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "Commercial intelligence summary could not be loaded.");
  }
}
