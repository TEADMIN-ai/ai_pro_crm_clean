import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationError,
  assertCanAccessContractor,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { getDealAnalyticsState, getDealById } from "@/server/services/dealService";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  ProcurementStateAuthorityError,
  assertDealWorkspaceAccess,
  assertNoGovernedProcurementMutation,
  buildSafeDealMetadataPatch,
  currentDealStateLabel,
  recordProcurementTransitionAudit,
} from "@/lib/procurement/procurementStateAuthority";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    const { dealId } = await context.params;
    const deal = await getDealById(dealId);

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.contractorId) {
      assertCanAccessContractor(actor, deal.contractorId);
    }

    const analytics = await getDealAnalyticsState(dealId);
    return NextResponse.json({ deal, analytics }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch deal:", error);
    return NextResponse.json({ error: "Failed to fetch deal" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const db = getFirebaseAdmin();
    const actor = await requireAuthorizedUser(req);
    assertPrivilegedRole(actor);

    const { dealId } = await context.params;
    const dealSnapshot = await db.collection("deals").doc(dealId).get();
    if (!dealSnapshot.exists) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const deal = { id: dealSnapshot.id, ...(dealSnapshot.data() ?? {}) } as Record<string, unknown> & { id: string };
    await assertDealWorkspaceAccess(actor, deal);

    const body = (await req.json()) as Record<string, unknown>;
    try {
      assertNoGovernedProcurementMutation(body);
    } catch (error) {
      if (error instanceof ProcurementStateAuthorityError) {
        await recordProcurementTransitionAudit({
          actor,
          workspaceId: typeof deal.workspaceId === "string" ? deal.workspaceId : null,
          dealId,
          action: "legacy_bypass_rejected",
          priorState: currentDealStateLabel(deal),
          requestedState: typeof body.status === "string" ? body.status : typeof body.stage === "string" ? body.stage : null,
          reason: error.message,
        });
      }
      throw error;
    }

    const patch = buildSafeDealMetadataPatch(body);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No safe editable deal metadata supplied" }, { status: 400 });
    }

    await db.collection("deals").doc(dealId).update({
      ...patch,
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof ProcurementStateAuthorityError) {
      return NextResponse.json(
        { error: err.message, transitionAuthority: "/api/opportunity-register/{dealId}/execution" },
        { status: err.status },
      );
    }

    console.error("PATCH DEAL ERROR:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const db = getFirebaseAdmin();
    const actor = await requireAuthorizedUser(req);

    if (actor.role !== "admin" && actor.role !== "manager") {
      throw new AuthorizationError("unauthorized", 403);
    }

    const { dealId } = await context.params;

    await db.collection("deals").doc(dealId).delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error("DELETE DEAL ERROR:", err);
    return NextResponse.json(
      { error: "Failed to delete deal" },
      { status: 500 },
    );
  }
}
