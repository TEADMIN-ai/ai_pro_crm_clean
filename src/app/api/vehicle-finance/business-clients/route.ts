export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createVehicleFinanceBusinessClient, listVehicleFinanceBusinessClients, VehicleFinanceProcurementValidationError } from "@/lib/vehicleFinance/vehicleFinanceService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    return NextResponse.json({ businessClients: await listVehicleFinanceBusinessClients() });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[vehicle-finance] business client list failed", error);
    return NextResponse.json({ error: "Business clients unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const businessClient = await createVehicleFinanceBusinessClient(await request.json(), { actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid });
    return NextResponse.json({ businessClient }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof VehicleFinanceProcurementValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[vehicle-finance] business client create failed", error);
    return NextResponse.json({ error: "Business client creation failed" }, { status: 500 });
  }
}
