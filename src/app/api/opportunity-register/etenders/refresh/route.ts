import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import type { EtendersSourceRecord } from "@/lib/etenders/types";
import { refreshImportedEtendersOpportunity } from "@/server/services/etendersOpportunityService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const body = (await request.json()) as {
      dealId?: string;
      previousSource?: EtendersSourceRecord;
      latestSource?: EtendersSourceRecord;
    };
    if (!body.dealId || !body.previousSource || !body.latestSource) {
      return NextResponse.json({ error: "Missing source refresh comparison payload" }, { status: 400 });
    }
    const result = await refreshImportedEtendersOpportunity({
      dealId: body.dealId,
      previousSource: body.previousSource,
      latestSource: body.latestSource,
      actor: user,
    });
    return NextResponse.json({ success: true, ...result, requiresReview: result.alerts.length > 0 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[etenders/refresh] failed", error);
    return NextResponse.json({ error: "Failed to refresh eTenders source metadata" }, { status: 500 });
  }
}

