export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getVehicleFinanceTrainingOverview } from "@/lib/vehicle-finance/training";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const overview = await getVehicleFinanceTrainingOverview();
    return NextResponse.json(overview);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[vehicle-finance-training] overview failed", error);
    return NextResponse.json({ error: "Vehicle finance training overview unavailable" }, { status: 500 });
  }
}

