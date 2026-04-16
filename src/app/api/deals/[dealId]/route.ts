import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationError,
  assertCanAccessContractor,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { getDealAnalyticsState, getDealById } from "@/server/services/dealService";
import { adminDb } from "@/lib/firebaseAdmin";

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
    const actor = await requireAuthorizedUser(req);
    assertPrivilegedRole(actor);

    const { status } = await req.json();

    if (!["approved", "rejected", "submitted"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { dealId } = await context.params;

    await adminDb.collection("deals").doc(dealId).update({
      status,
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
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
    const { dealId } = await context.params;

    await adminDb.collection("deals").doc(dealId).delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE DEAL ERROR:", err);
    return NextResponse.json(
      { error: "Failed to delete deal" },
      { status: 500 },
    );
  }
}
