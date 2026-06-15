export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createVehicleFinanceApplication, listVehicleFinanceApplications } from "@/lib/vehicleFinance/vehicleFinanceService";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const applications = await listVehicleFinanceApplications();
    return NextResponse.json({ applications });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] application list failed", error);
    return NextResponse.json({ error: "Vehicle finance applications unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const body = (await request.json()) as Record<string, unknown>;
    const customerId = getString(body.customerId);
    const vehicleId = getString(body.vehicleId);
    const dealerName = getString(body.dealerName);
    const dealValue = getNumber(body.dealValue);

    if (!customerId || !vehicleId || !dealerName) {
      return NextResponse.json({ error: "Missing application fields" }, { status: 400 });
    }

    const application = await createVehicleFinanceApplication(
      { customerId, vehicleId, dealerName, dealValue },
      { actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid },
    );

    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] application create failed", error);
    return NextResponse.json({ error: "Vehicle finance application creation failed" }, { status: 500 });
  }
}
