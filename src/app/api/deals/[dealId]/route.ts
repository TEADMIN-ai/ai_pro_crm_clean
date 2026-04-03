import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";
import { getDealAnalyticsState, getDealById } from "@/server/services/dealService";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

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
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const userDoc = await adminDb.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { role } = userDoc.data() || {};

    if (!["admin", "staff", "manager"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
    console.error("PATCH DEAL ERROR:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
