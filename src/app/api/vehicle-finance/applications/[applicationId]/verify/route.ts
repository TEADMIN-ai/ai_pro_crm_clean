export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { runVehicleFinanceAssessment } from "@/lib/vehicleFinance/vehicleFinanceService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const { applicationId } = await context.params;
    const result = await runVehicleFinanceAssessment(applicationId, {
      actorId: user.uid,
      actorRole: user.role,
      actorName: user.email ?? user.uid,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] verification failed", error);
    return NextResponse.json({ error: "Vehicle finance verification failed" }, { status: 500 });
  }
}
