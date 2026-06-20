import { NextRequest, NextResponse } from "next/server";

import { getRoarInventory } from "@/lib/vehicle-finance/roarInventory";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const inventory = await getRoarInventory();
    return NextResponse.json(inventory, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=900" },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[roar-inventory] sync failed", error);
    return NextResponse.json(
      {
        error: "Roar Cars inventory is temporarily unavailable",
        status: "UNAVAILABLE",
      },
      { status: 200 },
    );
  }
}
