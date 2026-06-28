import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import { calculatePriceMovementSignals, createMaterialPriceObservation, listMaterialPriceObservations } from "@/lib/qs/commercial-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { QSMaterialPriceObservation } from "@/types/qs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const observations = await listMaterialPriceObservations(500);
    return NextResponse.json({ observations, signals: calculatePriceMovementSignals(observations) });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Price observations could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const body = await request.json() as Partial<QSMaterialPriceObservation>;
    if (!body.materialId || !body.materialName || !body.unit || typeof body.price !== "number") {
      return jsonError("materialId, materialName, unit, and price are required.", 400);
    }
    const observation = await createMaterialPriceObservation({
      materialId: body.materialId,
      materialName: body.materialName,
      supplierId: body.supplierId ?? null,
      supplierName: body.supplierName ?? null,
      province: body.province ?? null,
      city: body.city ?? null,
      unit: body.unit,
      price: body.price,
      currency: body.currency ?? "ZAR",
      observedAt: body.observedAt ?? new Date().toISOString(),
      source: body.source ?? "manual",
      createdByUid: user.uid,
      updatedByUid: user.uid,
      createdBy: user.uid,
      updatedBy: user.uid,
    });
    return NextResponse.json({ observation }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Price observation could not be saved.");
  }
}
