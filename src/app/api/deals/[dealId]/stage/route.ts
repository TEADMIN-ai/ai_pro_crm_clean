import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, assertOperationalRole, requireAuthorizedUser } from "@/lib/server/authz";
import { normalizeDealStage } from "@/lib/deals/normalizeDealStage";
import {
  GOVERNED_PROCUREMENT_STATES,
  assertDealWorkspaceAccess,
  currentDealStateLabel,
  recordProcurementTransitionAudit,
} from "@/lib/procurement/procurementStateAuthority";
import { updateDealStageForRole } from "@/server/services/dealService";

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

    const db = getFirebaseAdmin();
    const dealSnapshot = await db.collection("deals").doc(dealId).get();
    if (!dealSnapshot.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const deal = { id: dealSnapshot.id, ...(dealSnapshot.data() ?? {}) } as Record<string, unknown> & { id: string };
    await assertDealWorkspaceAccess(actor, deal);

    if (GOVERNED_PROCUREMENT_STATES.has(nextStage.toLowerCase())) {
      await recordProcurementTransitionAudit({
        actor,
        workspaceId: typeof deal.workspaceId === "string" ? deal.workspaceId : null,
        dealId,
        action: "legacy_bypass_rejected",
        priorState: currentDealStateLabel(deal),
        requestedState: nextStage,
        reason: "Governed procurement stages must use the opportunity execution authority.",
      });
      return NextResponse.json(
        {
          error: "Governed procurement stages must use the opportunity execution authority.",
          transitionAuthority: `/api/opportunity-register/${dealId}/execution`,
        },
        { status: 409 },
      );
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
