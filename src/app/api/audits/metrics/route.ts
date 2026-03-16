import { NextRequest, NextResponse } from "next/server";
import { assertCanViewAuditModule } from "@/lib/audit/auditPermissions";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getAuditModuleDashboardMetrics } from "@/server/services/auditService";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanViewAuditModule(actor);

    const metrics = await getAuditModuleDashboardMetrics(actor);
    return NextResponse.json({ metrics }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch audit metrics:", error);
    return NextResponse.json({ error: "Failed to fetch audit metrics" }, { status: 500 });
  }
}
