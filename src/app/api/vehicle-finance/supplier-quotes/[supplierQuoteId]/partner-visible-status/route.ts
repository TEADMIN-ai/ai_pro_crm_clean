import { NextRequest, NextResponse } from "next/server";

import { requireAuthorizedUser, assertVehicleFinanceRole } from "@/lib/server/authz";
import {
  publishVehicleFinancePartnerVisibleStatus,
  VehicleFinanceProcurementValidationError,
} from "@/lib/vehicleFinance/vehicleFinanceService";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ supplierQuoteId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);

    const { supplierQuoteId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const supplierQuote = await publishVehicleFinancePartnerVisibleStatus(supplierQuoteId, body, {
      actorId: user.uid,
      actorRole: user.role,
      actorName: user.email,
    });

    return NextResponse.json({ supplierQuote });
  } catch (error) {
    const status = error instanceof VehicleFinanceProcurementValidationError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Partner-visible status publication failed";
    return NextResponse.json({ error: message }, { status });
  }
}
