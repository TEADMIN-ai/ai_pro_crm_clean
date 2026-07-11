export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getVehicleFinanceOverview } from "@/lib/vehicleFinance/vehicleFinanceService";
import { searchVehicleFinanceApplications } from "@/lib/vehicle-finance/operations/vehicleFinanceOperations";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);

    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const overview = await getVehicleFinanceOverview();
    const results = searchVehicleFinanceApplications({
      query,
      applications: overview.applications,
      customers: overview.customers,
      documents: overview.documents,
    });

    return NextResponse.json({
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[vehicle-finance] search failed", error);
    return NextResponse.json({ error: "Vehicle finance search unavailable" }, { status: 500 });
  }
}
