import { NextRequest, NextResponse } from "next/server";
import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { listQsRecords } from "@/lib/qs/firestore";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import { logSupplierContactAction } from "@/lib/qs/supplier-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { QSSupplierContactAction, QSSupplierContactActionType } from "@/types/qs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_TYPES: QSSupplierContactActionType[] = [
  "CALL_SUPPLIER",
  "EMAIL_SUPPLIER",
  "REQUEST_QUOTE",
  "REQUEST_DELIVERY_COST",
  "SAVE_SUPPLIER",
  "COMPARE_SUPPLIER",
];

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const actions = await listQsRecords<QSSupplierContactAction>(QS_COLLECTIONS.qsSupplierContactActions, { limit: 500 });
    return NextResponse.json({ actions });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_SUPPLIER_CONTACT_ACTIONS_GET_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "Supplier contact actions could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const body = (await request.json()) as Record<string, unknown>;
    const actionType = typeof body.actionType === "string" && ACTION_TYPES.includes(body.actionType as QSSupplierContactActionType)
      ? body.actionType as QSSupplierContactActionType
      : null;
    const supplierId = typeof body.supplierId === "string" ? body.supplierId.trim() : "";

    if (!supplierId || !actionType) {
      return jsonError("supplierId and a supported actionType are required.", 400);
    }

    const action = await logSupplierContactAction({
      userUid: user.uid,
      userRole: user.role,
      contractorId: user.contractorId ?? null,
      supplierId,
      supplierName: typeof body.supplierName === "string" ? body.supplierName : null,
      estimateId: typeof body.estimateId === "string" ? body.estimateId : null,
      estimateLineId: typeof body.estimateLineId === "string" ? body.estimateLineId : null,
      materialId: typeof body.materialId === "string" ? body.materialId : null,
      boqLineItemId: typeof body.boqLineItemId === "string" ? body.boqLineItemId : null,
      actionType,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    console.error("[QS_SUPPLIER_CONTACT_ACTION_CREATE_FAILED]", error);
    return jsonError(error instanceof Error ? error.message : "Supplier contact action could not be logged.");
  }
}
