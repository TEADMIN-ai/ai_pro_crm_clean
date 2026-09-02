export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinancePartnerRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getVehicleFinancePartnerPortalOverview, VehicleFinanceProcurementValidationError } from "@/lib/vehicleFinance/vehicleFinanceService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinancePartnerRole(user);
    const overview = await getVehicleFinancePartnerPortalOverview({ supplierId: user.vehicleFinanceSupplierId!, actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid });
    return NextResponse.json(overview);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof VehicleFinanceProcurementValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[vehicle-finance] partner overview failed", error);
    return NextResponse.json({ error: "Partner portal unavailable" }, { status: 500 });
  }
}
