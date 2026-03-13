import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertOperationalRole, requireAuthorizedUser } from "@/lib/server/authz";
import { updateDealStageForRole } from "@/server/services/dealService";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertOperationalRole(actor);
    const { dealId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const nextStage = typeof body.stage === "string" ? body.stage.trim() : "";

    if (!nextStage) {
      return NextResponse.json({ error: "Missing stage" }, { status: 400 });
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

    const message = error instanceof Error ? error.message : "Failed to update deal stage";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
