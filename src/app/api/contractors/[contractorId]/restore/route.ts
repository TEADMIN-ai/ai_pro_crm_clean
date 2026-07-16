import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { restoreContractorById } from "@/server/services/contractorService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    const { contractorId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = typeof body.reason === "string" ? body.reason : undefined;
    const contractor = await restoreContractorById({ contractorId, reason, actor: user });
    return NextResponse.json({ success: true, contractor });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Restore failed";
    return NextResponse.json({ success: false, error: message }, { status: message === "Contractor not found" ? 404 : 500 });
  }
}
