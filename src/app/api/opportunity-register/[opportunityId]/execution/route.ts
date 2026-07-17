import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { applyOpportunityExecutionAction, getOpportunityExecutionView } from "@/server/services/opportunityExecutionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function statusFromError(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
}

export async function GET(request: NextRequest, context: { params: Promise<{ opportunityId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { opportunityId } = await context.params;
    return NextResponse.json(await getOpportunityExecutionView(opportunityId, actor));
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load execution workflow" }, { status: statusFromError(error) });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ opportunityId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { opportunityId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await applyOpportunityExecutionAction({
      dealId: opportunityId,
      action: String(body.action ?? ""),
      actor,
      contractorId: typeof body.contractorId === "string" ? body.contractorId : undefined,
      requirements: body.requirements && typeof body.requirements === "object" ? body.requirements : undefined,
      submission: body.submission && typeof body.submission === "object" ? body.submission : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update execution workflow" }, { status: statusFromError(error) });
  }
}
