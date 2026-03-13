import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";
import { getDealById, listDealActivity } from "@/server/services/dealService";

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

    const activity = await listDealActivity(dealId);
    return NextResponse.json({ activity }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch deal activity:", error);
    return NextResponse.json({ error: "Failed to fetch deal activity" }, { status: 500 });
  }
}
