import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { assignDeal, getDealById } from "@/server/services/dealService";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { dealId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const assignedToRaw = typeof body.assignedTo === "string" ? body.assignedTo.trim() : "";
    const deal = await getDealById(dealId);

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    await assignDeal({
      dealId,
      assignedTo: assignedToRaw || null,
      actorEmail: actor.email,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to assign deal:", error);
    return NextResponse.json({ error: "Failed to assign deal" }, { status: 500 });
  }
}
