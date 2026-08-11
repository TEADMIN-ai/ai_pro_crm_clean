import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { verifySupplierQuoteLine } from "@/server/services/commercialAuthorityService";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { quoteId } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.lineId !== "string" || typeof body.itemId !== "string") return NextResponse.json({ error: "lineId and canonical itemId are required" }, { status: 400 });
    const costLine = await verifySupplierQuoteLine({ quoteId, lineId: body.lineId, itemId: body.itemId, actor });
    return NextResponse.json({ costLine });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Supplier cost verification failed", code: (error as { code?: string })?.code, blockers: (error as { blockers?: unknown })?.blockers }, { status: (error as { status?: number })?.status ?? 500 });
  }
}
