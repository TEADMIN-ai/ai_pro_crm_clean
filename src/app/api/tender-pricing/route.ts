import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import {
  getTenderPricingWorkspaceForDeal,
  startTenderPricingWorkspace,
} from "@/server/services/tenderPricingService";

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

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get("dealId")?.trim();
    if (!dealId) return jsonError("dealId is required.", 400);
    return NextResponse.json({ pricing: await getTenderPricingWorkspaceForDeal(dealId, actor) });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Tender pricing could not be loaded.", statusFromError(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const body = await request.json().catch(() => ({}));
    const dealId = typeof body.dealId === "string" && body.dealId.trim() ? body.dealId.trim() : "";
    if (!dealId) return jsonError("dealId is required.", 400);
    return NextResponse.json({ pricing: await startTenderPricingWorkspace({ dealId, actor, body }) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Tender pricing could not be started.", statusFromError(error));
  }
}

