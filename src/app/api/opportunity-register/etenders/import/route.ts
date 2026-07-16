import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import type { EtendersImportReviewInput } from "@/lib/etenders/types";
import { importReviewedEtendersOpportunity } from "@/server/services/etendersOpportunityService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const body = (await request.json()) as EtendersImportReviewInput;
    if (!body?.sourceRecord?.sourceOpportunityId) {
      return NextResponse.json({ error: "Missing reviewed eTenders source record" }, { status: 400 });
    }
    if (!body.rejectedAsIrrelevant && (!Array.isArray(body.selectedSectorIds) || body.selectedSectorIds.length === 0)) {
      return NextResponse.json({ error: "Select at least one Torque Empire sector before import" }, { status: 400 });
    }
    const result = await importReviewedEtendersOpportunity(body, user);
    return NextResponse.json({
      success: true,
      ...result,
      nextAction: `/dashboard/deals/${result.id}`,
    }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[etenders/import] failed", error);
    return NextResponse.json({ error: "Failed to import reviewed eTenders opportunity" }, { status: 500 });
  }
}

