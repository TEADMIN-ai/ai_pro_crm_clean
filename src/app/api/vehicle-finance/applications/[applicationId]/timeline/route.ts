export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getVehicleFinanceAuditTrail } from "@/lib/vehicleFinance/vehicleFinanceService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const { applicationId } = await context.params;
    const trail = await getVehicleFinanceAuditTrail(applicationId);
    return NextResponse.json(trail);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] timeline fetch failed", error);
    return NextResponse.json({ error: "Vehicle finance timeline unavailable" }, { status: 500 });
  }
}
