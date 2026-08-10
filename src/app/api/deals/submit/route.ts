import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { applyOpportunityExecutionAction } from "@/server/services/opportunityExecutionService";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthorizedUser(req);
    if (user.role === "guest") {
      throw new AuthorizationError("unauthorized", 403);
    }

    const body = (await req.json()) as Record<string, unknown>;
    const dealId = typeof body.dealId === "string" ? body.dealId.trim() : "";

    if (!dealId) {
      return NextResponse.json({ error: "Missing dealId" }, { status: 400 });
    }

    const submission =
      body.submission && typeof body.submission === "object"
        ? (body.submission as Record<string, unknown>)
        : body;

    const result = await applyOpportunityExecutionAction({
      dealId,
      action: "record_submission",
      actor: user,
      submission,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : "Failed to update deal";
    if (status >= 500) {
      console.error("DEAL SUBMIT ERROR:", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
