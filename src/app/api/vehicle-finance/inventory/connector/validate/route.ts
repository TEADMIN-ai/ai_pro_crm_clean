import { NextRequest, NextResponse } from "next/server";

import { validateConnection } from "@/lib/vehicle-finance/inventory/roarCarsConnector";
import { assertVehicleFinanceStaffRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceStaffRole(user);
    const result = await validateConnection(user.uid);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connector validation failed" }, { status: 500 });
  }
}
