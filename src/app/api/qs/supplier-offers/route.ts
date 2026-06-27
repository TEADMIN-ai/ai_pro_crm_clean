import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import { createSupplierOffer, listSupplierOffers } from "@/lib/qs/supplier-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { QSSupplierProductOffer } from "@/types/qs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const offers = await listSupplierOffers(1000);
    return NextResponse.json({ offers });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_SUPPLIER_OFFERS_LIST_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS supplier offers could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const body = (await request.json()) as Partial<QSSupplierProductOffer>;

    if (!body.supplierId || !body.materialId || !body.materialName || !body.unit || typeof body.unitPriceExVat !== "number") {
      return jsonError("supplierId, materialId, materialName, unit, and unitPriceExVat are required.", 400);
    }

    const timestamp = new Date().toISOString();
    const offer = await createSupplierOffer({
      offerId: typeof body.offerId === "string" ? body.offerId : "",
      supplierId: body.supplierId,
      materialId: body.materialId,
      materialName: body.materialName,
      category: body.category ?? null,
      unit: body.unit,
      unitPriceExVat: body.unitPriceExVat,
      vatRate: typeof body.vatRate === "number" ? body.vatRate : 0.15,
      stockStatus: body.stockStatus ?? "unknown",
      availableQuantity: body.availableQuantity ?? null,
      leadTimeDays: body.leadTimeDays ?? null,
      deliveryFee: body.deliveryFee ?? null,
      validFrom: body.validFrom ?? null,
      validUntil: body.validUntil ?? null,
      qualityGrade: body.qualityGrade ?? null,
      brand: body.brand ?? null,
      warranty: body.warranty ?? null,
      notes: body.notes ?? null,
      pricingSource: body.pricingSource ?? "supplierCatalogue",
      status: body.status ?? "active",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: user.uid,
      updatedBy: user.uid,
      createdByUid: user.uid,
      updatedByUid: user.uid,
    });

    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_SUPPLIER_OFFER_CREATE_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS supplier offer could not be created.");
  }
}
