import { NextRequest, NextResponse } from "next/server";

import { getInventoryHealth } from "@/lib/vehicle-finance/inventory/roarCarsConnector";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const health = await getInventoryHealth();
    return NextResponse.json({ health });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Connector health could not be loaded" }, { status: 500 });
  }
}
