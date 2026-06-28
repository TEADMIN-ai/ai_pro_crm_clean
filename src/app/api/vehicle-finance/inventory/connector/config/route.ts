import { NextRequest, NextResponse } from "next/server";

import { getRoarConnectorConfig } from "@/lib/vehicle-finance/inventory/roarCarsConnector";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const config = await getRoarConnectorConfig();
    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Connector config could not be loaded" }, { status: 500 });
  }
}
