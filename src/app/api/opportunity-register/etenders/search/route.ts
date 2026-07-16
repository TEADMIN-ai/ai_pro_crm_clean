import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import type { EtendersSearchFilters } from "@/lib/etenders/types";
import { EtendersSourceError } from "@/lib/etenders/client";
import { searchEtendersOpportunities } from "@/server/services/etendersOpportunityService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function boolParam(value: string | null): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const params = request.nextUrl.searchParams;
    const filters: EtendersSearchFilters = {
      keywords: params.get("keywords") ?? undefined,
      tenderNumber: params.get("tenderNumber") ?? undefined,
      category: params.get("category") ?? undefined,
      province: params.get("province") ?? undefined,
      organOfState: params.get("organOfState") ?? undefined,
      tenderType: params.get("tenderType") ?? undefined,
      eSubmissionAccepted: boolParam(params.get("eSubmissionAccepted")),
      advertisedFrom: params.get("advertisedFrom") ?? undefined,
      advertisedTo: params.get("advertisedTo") ?? undefined,
      closingFrom: params.get("closingFrom") ?? undefined,
      closingTo: params.get("closingTo") ?? undefined,
      preset: params.get("preset") as EtendersSearchFilters["preset"],
    };
    const start = Number(params.get("start") ?? 0);
    const length = Number(params.get("length") ?? 10);
    const result = await searchEtendersOpportunities(filters, { start, length });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof EtendersSourceError) {
      return NextResponse.json({ error: "eTenders source request failed", details: error.message }, { status: 502 });
    }
    console.error("[etenders/search] failed", error);
    return NextResponse.json({ error: "eTenders search unavailable" }, { status: 500 });
  }
}

