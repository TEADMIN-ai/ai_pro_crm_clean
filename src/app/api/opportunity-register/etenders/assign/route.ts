import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { assignEtendersContractor } from "@/server/services/etendersOpportunityService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const body = (await request.json()) as { dealId?: string; contractorId?: string };
    if (!body.dealId || !body.contractorId) {
      return NextResponse.json({ error: "Missing dealId or contractorId" }, { status: 400 });
    }
    const execution = await assignEtendersContractor({ dealId: body.dealId, contractorId: body.contractorId, actor: user });
    return NextResponse.json({ success: true, execution, redirectTo: execution.route });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to assign contractor";
    const status = /cross-workspace/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

