export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinancePartnerRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { updateVehicleFinancePartnerQuoteAction, VehicleFinanceProcurementValidationError } from "@/lib/vehicleFinance/vehicleFinanceService";

type Props = { params: Promise<{ supplierQuoteId: string }> };

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinancePartnerRole(user);
    const { supplierQuoteId } = await params;
    const supplierQuote = await updateVehicleFinancePartnerQuoteAction(supplierQuoteId, await request.json(), { supplierId: user.vehicleFinanceSupplierId!, actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid });
    return NextResponse.json({ supplierQuote });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof VehicleFinanceProcurementValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[vehicle-finance] partner quote action failed", error);
    return NextResponse.json({ error: "Partner quote update failed" }, { status: 500 });
  }
}
