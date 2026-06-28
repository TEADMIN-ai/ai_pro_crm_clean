import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import { createSupplierPerformanceRating, listSupplierPerformanceRatings } from "@/lib/qs/commercial-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { QSSupplierPerformanceRating } from "@/types/qs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const ratings = await listSupplierPerformanceRatings(500);
    return NextResponse.json({ ratings });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier ratings could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const body = await request.json() as Partial<QSSupplierPerformanceRating>;
    if (!body.supplierId) return jsonError("supplierId is required.", 400);
    const rating = await createSupplierPerformanceRating({
      supplierId: body.supplierId,
      supplierName: body.supplierName ?? null,
      estimateId: body.estimateId ?? null,
      projectId: body.projectId ?? null,
      deliveryReliabilityScore: Number(body.deliveryReliabilityScore ?? 0),
      priceAccuracyScore: Number(body.priceAccuracyScore ?? 0),
      qualityRating: Number(body.qualityRating ?? 0),
      stockAccuracyScore: Number(body.stockAccuracyScore ?? 0),
      communicationRating: Number(body.communicationRating ?? 0),
      returnsDefectsRate: Number(body.returnsDefectsRate ?? 0),
      invoiceAccuracyScore: Number(body.invoiceAccuracyScore ?? 0),
      notes: body.notes ?? null,
      createdByUid: user.uid,
      updatedByUid: user.uid,
      createdBy: user.uid,
      updatedBy: user.uid,
    });
    return NextResponse.json({ rating }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier rating could not be saved.");
  }
}
