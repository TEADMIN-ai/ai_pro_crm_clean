import { NextRequest, NextResponse } from "next/server";

import { retrySync } from "@/lib/vehicle-finance/inventory/roarCarsConnector";
import { InventorySyncInProgressError } from "@/lib/vehicle-finance/inventory/durableInventorySync";
import { assertVehicleFinanceStaffRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceStaffRole(user);
    const payload = await retrySync({ actorId: user.uid, actorEmail: user.email, actorRole: user.role });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof InventorySyncInProgressError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connector sync failed" }, { status: 500 });
  }
}
