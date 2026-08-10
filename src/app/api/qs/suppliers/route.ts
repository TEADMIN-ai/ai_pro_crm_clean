import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import { FirestoreMasterDataRepository, actorFromAuthorizedUser, resolveSupplierForQuote } from "@/lib/master-data";
import { createSupplierProfile, listSupplierProfiles } from "@/lib/qs/supplier-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { QSSupplierProfile, QsProvince } from "@/types/qs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function numberScore(value: unknown, fallback = 70) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);

    const suppliers = await listSupplierProfiles(500);
    return NextResponse.json({ suppliers });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_SUPPLIERS_LIST_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS suppliers could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);

    const body = (await request.json()) as Partial<QSSupplierProfile> & { workspaceId?: string | null };
    const supplierName = typeof body.supplierName === "string" ? body.supplierName.trim() : "";
    if (!supplierName) return jsonError("Supplier name is required.", 400);

    const workspaceId = typeof body.workspaceId === "string" && body.workspaceId.trim() ? body.workspaceId.trim() : user.workspaceId;
    if (!workspaceId) return jsonError("workspaceId is required for canonical supplier creation.", 400);
    if (user.workspaceId && user.workspaceId !== workspaceId) return jsonError("Cross-workspace access rejected.", 403);

    const supplierResolution = await resolveSupplierForQuote({
      actor: actorFromAuthorizedUser(user, workspaceId),
      repository: new FirestoreMasterDataRepository(),
      supplier: {
        workspaceId,
        supplierId: typeof body.supplierId === "string" ? body.supplierId.trim() : "",
        supplierName,
        legalName: typeof body.supplierName === "string" ? body.supplierName.trim() : supplierName,
        tradingName: body.tradingName ?? null,
        registrationNumber: body.companyRegistrationNumber ?? null,
        vatNumber: body.vatNumber ?? null,
        contactPerson: body.contactPerson ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        regionCoverage: (Array.isArray(body.deliveryAreas) ? body.deliveryAreas : ["National"]) as string[],
        paymentTerms: body.paymentTerms ?? null,
        evidenceReferences: [],
      },
    });
    if (!supplierResolution.supplierId) {
      return jsonError(`Master Supplier resolution required before QS supplier profile creation: ${supplierResolution.reason}`, 409);
    }

    const timestamp = new Date().toISOString();
    const qualityScore = numberScore(body.qualityScore);
    const reliabilityScore = numberScore(body.reliabilityScore);
    const deliveryScore = numberScore(body.deliveryScore);
    const priceCompetitivenessScore = numberScore(body.priceCompetitivenessScore);
    const stockAvailabilityScore = numberScore(body.stockAvailabilityScore);
    const overallSupplierScore = Math.round((qualityScore + reliabilityScore + deliveryScore + priceCompetitivenessScore + stockAvailabilityScore) / 5);

    const supplier = await createSupplierProfile({
      supplierId: supplierResolution.supplierId,
      supplierName,
      tradingName: body.tradingName ?? null,
      companyRegistrationNumber: body.companyRegistrationNumber ?? null,
      vatNumber: body.vatNumber ?? null,
      bbbeeLevel: body.bbbeeLevel ?? null,
      contactPerson: body.contactPerson ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      website: body.website ?? null,
      branches: Array.isArray(body.branches) ? body.branches : [],
      deliveryAreas: (Array.isArray(body.deliveryAreas) ? body.deliveryAreas : ["National"]) as QsProvince[],
      productCategories: stringArray(body.productCategories),
      paymentTerms: body.paymentTerms ?? null,
      warrantyNotes: body.warrantyNotes ?? null,
      qualityScore,
      reliabilityScore,
      deliveryScore,
      priceCompetitivenessScore,
      stockAvailabilityScore,
      overallSupplierScore,
      isPreferredSupplier: body.isPreferredSupplier ?? false,
      isSponsoredSupplier: body.isSponsoredSupplier ?? false,
      supplierSubscriptionTier: body.supplierSubscriptionTier ?? "none",
      leadFeeEnabled: body.leadFeeEnabled ?? false,
      leadFeeAmount: body.leadFeeAmount ?? null,
      referralCommissionEnabled: body.referralCommissionEnabled ?? false,
      referralCommissionPercentage: body.referralCommissionPercentage ?? null,
      featuredPlacementEnabled: body.featuredPlacementEnabled ?? false,
      status: body.status ?? "active",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: user.uid,
      updatedBy: user.uid,
      createdByUid: user.uid,
      updatedByUid: user.uid,
    });

    return NextResponse.json({ supplier, supplierResolution }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_SUPPLIER_CREATE_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS supplier could not be created.");
  }
}
