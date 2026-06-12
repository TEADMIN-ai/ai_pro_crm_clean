export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { getIntelligenceCenterOverview } from "@/server/services/intelligenceCenterService";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);

    const overview = await getIntelligenceCenterOverview();
    return NextResponse.json(overview, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[intelligence-center] overview failed", error);
    return NextResponse.json({ error: "Intelligence Center overview unavailable" }, { status: 500 });
  }
}
