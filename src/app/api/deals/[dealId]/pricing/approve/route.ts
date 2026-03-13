import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { approveDealPricing } from "@/server/services/dealService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ dealId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { dealId } = await context.params;
    await approveDealPricing({ dealId, managerUid: actor.uid });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to approve pricing";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
