import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import { listSupplierDecisionFlags, upsertSupplierDecisionFlag } from "@/lib/qs/commercial-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import type { QSSupplierDecisionFlagReason, QSSupplierDecisionStatus } from "@/types/qs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: QSSupplierDecisionStatus[] = ["preferred", "watchlist", "blocked", "neutral"];
const REASONS: QSSupplierDecisionFlagReason[] = [
  "commercial_performance",
  "delivery_performance",
  "quality_concerns",
  "pricing_accuracy",
  "stock_reliability",
  "management_decision",
  "other",
];

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const flags = await listSupplierDecisionFlags(500);
    return NextResponse.json({ flags });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier decision flags could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const body = await request.json() as {
      supplierId?: string;
      supplierName?: string | null;
      status?: QSSupplierDecisionStatus;
      reason?: QSSupplierDecisionFlagReason;
      notes?: string | null;
    };
    if (!body.supplierId) return jsonError("supplierId is required.", 400);
    if (!body.status || !STATUSES.includes(body.status)) return jsonError("A valid status is required.", 400);
    if (!body.reason || !REASONS.includes(body.reason)) return jsonError("A valid reason is required.", 400);
    const flag = await upsertSupplierDecisionFlag({
      supplierId: body.supplierId,
      supplierName: body.supplierName ?? null,
      status: body.status,
      reason: body.reason,
      notes: body.notes ?? null,
      setByUid: user.uid,
    });
    return NextResponse.json({ flag });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier decision flag could not be saved.");
  }
}
