export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createVehicleFinanceProcurementCase, listVehicleFinanceProcurementCases, VehicleFinanceProcurementValidationError } from "@/lib/vehicleFinance/vehicleFinanceService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    return NextResponse.json({ procurementCases: await listVehicleFinanceProcurementCases() });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[vehicle-finance] procurement case list failed", error);
    return NextResponse.json({ error: "Procurement cases unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const procurementCase = await createVehicleFinanceProcurementCase(await request.json(), { actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid });
    return NextResponse.json({ procurementCase }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof VehicleFinanceProcurementValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[vehicle-finance] procurement case create failed", error);
    return NextResponse.json({ error: "Procurement case creation failed" }, { status: 500 });
  }
}
