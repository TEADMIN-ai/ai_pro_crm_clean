import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { rejectTenderIntelligence } from "@/server/services/tenderIntelligenceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function statusFromError(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : 500;
}

export async function POST(request: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    const { dealId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const intelligence = await rejectTenderIntelligence(dealId, actor, typeof body.reason === "string" ? body.reason : null);
    return NextResponse.json({ intelligence });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Tender intelligence could not be rejected.", statusFromError(error));
  }
}

