export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getVehicleFinanceApplication } from "@/lib/vehicleFinance/vehicleFinanceService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const { applicationId } = await context.params;
    if (!applicationId?.trim()) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    const payload = await getVehicleFinanceApplication(applicationId.trim());
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] application lookup failed", error);
    return NextResponse.json({ error: "Vehicle finance application unavailable" }, { status: 500 });
  }
}

