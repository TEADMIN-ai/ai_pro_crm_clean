import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import { getSupplierProfile, updateSupplierProfile } from "@/lib/qs/supplier-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { QSSupplierProfile } from "@/types/qs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ supplierId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const { supplierId } = await context.params;
    const supplier = await getSupplierProfile(supplierId);
    if (!supplier) return jsonError("QS supplier not found.", 404);
    return NextResponse.json({ supplier });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_SUPPLIER_GET_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS supplier could not be loaded.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ supplierId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const { supplierId } = await context.params;
    const body = (await request.json()) as Partial<QSSupplierProfile>;
    const supplier = await updateSupplierProfile(supplierId, {
      ...body,
      updatedBy: user.uid,
      updatedByUid: user.uid,
      version: typeof body.version === "number" ? body.version + 1 : undefined,
    });
    return NextResponse.json({ supplier });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_SUPPLIER_UPDATE_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "QS supplier could not be updated.");
  }
}
