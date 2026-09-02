export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { updateVehicleFinanceProcurementCaseLifecycle, VehicleFinanceProcurementValidationError } from "@/lib/vehicleFinance/vehicleFinanceService";

type Props = { params: Promise<{ procurementCaseId: string }> };
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const { procurementCaseId } = await params;
    const body = await request.json();
    const procurementCase = await updateVehicleFinanceProcurementCaseLifecycle(procurementCaseId, String(body.lifecycleStatus ?? ""), { actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid }, String(body.note ?? "Lifecycle updated"));
    return NextResponse.json({ procurementCase });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof VehicleFinanceProcurementValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[vehicle-finance] procurement case update failed", error);
    return NextResponse.json({ error: "Procurement case update failed" }, { status: 500 });
  }
}
