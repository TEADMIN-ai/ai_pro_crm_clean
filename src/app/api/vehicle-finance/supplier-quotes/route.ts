export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createVehicleFinanceSupplierQuote, listVehicleFinanceSupplierQuotes, VehicleFinanceProcurementValidationError } from "@/lib/vehicleFinance/vehicleFinanceService";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const caseId = request.nextUrl.searchParams.get("procurementCaseId") ?? undefined;
    return NextResponse.json({ supplierQuotes: await listVehicleFinanceSupplierQuotes(caseId) });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[vehicle-finance] supplier quote list failed", error);
    return NextResponse.json({ error: "Supplier quotes unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const supplierQuote = await createVehicleFinanceSupplierQuote(await request.json(), { actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid });
    return NextResponse.json({ supplierQuote }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof VehicleFinanceProcurementValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[vehicle-finance] supplier quote create failed", error);
    return NextResponse.json({ error: "Supplier quote creation failed" }, { status: 500 });
  }
}
