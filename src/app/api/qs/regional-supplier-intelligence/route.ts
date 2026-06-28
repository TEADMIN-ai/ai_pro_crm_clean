import { NextRequest, NextResponse } from "next/server";
import { assertQsInternalAccess } from "@/lib/qs/apiAuth";
import { buildRegionalSupplierInsights, listSupplierPerformanceRatings } from "@/lib/qs/commercial-intelligence";
import { listSupplierOffers, listSupplierProfiles } from "@/lib/qs/supplier-intelligence";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertQsInternalAccess(user);
    const [suppliers, offers, ratings] = await Promise.all([
      listSupplierProfiles(500),
      listSupplierOffers(1000),
      listSupplierPerformanceRatings(500),
    ]);
    return NextResponse.json({ regionalInsights: buildRegionalSupplierInsights(suppliers, offers, ratings) });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Regional supplier intelligence could not be loaded.");
  }
}
