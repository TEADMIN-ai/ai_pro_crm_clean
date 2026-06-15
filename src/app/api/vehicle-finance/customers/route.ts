export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertPrivilegedRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createVehicleFinanceCustomer, listVehicleFinanceCustomers } from "@/lib/vehicleFinance/vehicleFinanceService";

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
    const customers = await listVehicleFinanceCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] customer list failed", error);
    return NextResponse.json({ error: "Vehicle finance customers unavailable" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const body = (await request.json()) as Record<string, unknown>;
    const firstName = getString(body.firstName);
    const lastName = getString(body.lastName);
    const idNumber = getString(body.idNumber);
    const phone = getString(body.phone);
    const email = getString(body.email);
    const address = getString(body.address);
    const employer = getString(body.employer);
    const monthlyIncome = getNumber(body.monthlyIncome);

    if (!firstName || !lastName || !idNumber || !phone || !email) {
      return NextResponse.json({ error: "Missing customer fields" }, { status: 400 });
    }

    const customer = await createVehicleFinanceCustomer(
      { firstName, lastName, idNumber, phone, email, address, employer, monthlyIncome },
      { actorId: user.uid, actorRole: user.role, actorName: user.email ?? user.uid },
    );

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] customer create failed", error);
    return NextResponse.json({ error: "Vehicle finance customer creation failed" }, { status: 500 });
  }
}
