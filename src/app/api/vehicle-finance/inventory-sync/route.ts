import { NextRequest, NextResponse } from "next/server";

import {
  InventorySyncInProgressError,
} from "@/lib/vehicle-finance/inventory/durableInventorySync";
import { retrySync } from "@/lib/vehicle-finance/inventory/roarCarsConnector";
import {
  assertVehicleFinanceStaffRole,
  AuthorizationError,
  requireAuthorizedUser,
} from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function syncError(error: unknown) {
  if (error instanceof InventorySyncInProgressError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  console.error("[inventory-sync] failed", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Inventory synchronization failed" },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "Inventory scheduler is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await retrySync({ actorId: "vercel-cron", actorRole: "system" });
    return NextResponse.json(result);
  } catch (error) {
    return syncError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceStaffRole(user);
    const result = await retrySync({
      actorId: user.uid,
      actorEmail: user.email,
      actorRole: user.role,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return syncError(error);
  }
}
