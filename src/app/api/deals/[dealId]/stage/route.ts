import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertOperationalRole, requireAuthorizedUser } from "@/lib/server/authz";
import { updateDealStageForRole } from "@/server/services/dealService";
import { normalizeDealStage } from "@/lib/deals/normalizeDealStage";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertOperationalRole(actor);

    if (actor.role === "contractor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { dealId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const requestedStage = typeof body.stage === "string" ? body.stage.trim() : "";

    if (!requestedStage) {
      return NextResponse.json({ error: "Missing stage" }, { status: 400 });
    }

    const nextStage = normalizeDealStage(requestedStage);

    if (nextStage !== requestedStage) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }

    await updateDealStageForRole({
      dealId,
      nextStage,
      role: actor.role,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("STAGE UPDATE ERROR:", error);
    const message = error instanceof Error ? error.message : "Failed to update deal stage";
    const status =
      message === "Deal not found"
        ? 404
        : message.startsWith("Invalid transition") || message === "Rejected pricing cannot move forward in the workflow."
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
