import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";
import { getDealAnalyticsState, getDealById, persistDealAnalytics } from "@/server/services/dealService";

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
    return NextResponse.json({ analytics }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch deal analytics:", error);
    return NextResponse.json({ error: "Failed to fetch deal analytics" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    const { dealId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const deal = await getDealById(dealId);

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.contractorId) {
      assertCanAccessContractor(actor, deal.contractorId);
    }

    await persistDealAnalytics({
      dealId,
      winProbability: typeof body.winProbability === "number" ? body.winProbability : undefined,
      riskScore: typeof body.riskScore === "number" ? body.riskScore : undefined,
      documentIntelligence:
        body.documentIntelligence && typeof body.documentIntelligence === "object"
          ? (body.documentIntelligence as Record<string, unknown>)
          : undefined,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to persist deal analytics:", error);
    return NextResponse.json({ error: "Failed to persist deal analytics" }, { status: 500 });
  }
}
