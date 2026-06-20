export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createVehicleFinanceApplication, listVehicleFinanceApplications } from "@/lib/vehicleFinance/vehicleFinanceService";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
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
    assertVehicleFinanceRole(user);
    const body = (await request.json()) as Record<string, unknown>;
    const customerId = getString(body.customerId);
    const vehicleId = getString(body.vehicleId) || getString(body.vehicleInventoryId) || getString(body.vehicleTitle);
    const vehicleInventoryId = getString(body.vehicleInventoryId);
    const vehicleTitle = getString(body.vehicleTitle) || null;
    const vehiclePrice = getOptionalNumber(body.vehiclePrice);
    const vehicleYear = getOptionalNumber(body.vehicleYear);
    const vehicleMileage = getOptionalNumber(body.vehicleMileage);
    const vehicleImageUrl = getString(body.vehicleImageUrl) || null;
    const vehicleListingUrl = getString(body.vehicleListingUrl) || null;
    const inventorySource = getString(body.inventorySource) || null;
    const dealerName = getString(body.dealerName);
    const dealValue = getNumber(body.dealValue);

    if (!customerId || !vehicleId || !dealerName) {
      return NextResponse.json({ error: "Missing application fields" }, { status: 400 });
    }

    const application = await createVehicleFinanceApplication(
      {
        customerId,
        vehicleId,
        dealerName,
        dealValue,
        vehicleInventoryId: vehicleInventoryId || undefined,
        vehicleTitle,
        vehiclePrice,
        vehicleYear,
        vehicleMileage,
        vehicleImageUrl,
        vehicleListingUrl,
        inventorySource,
      },
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

