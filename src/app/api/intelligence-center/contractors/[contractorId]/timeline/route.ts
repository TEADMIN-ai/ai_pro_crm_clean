export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationError,
  assertCanAccessContractor,
  assertPrivilegedRole,
  requireAuthorizedUser,
} from "@/lib/server/authz";
import { getContractorTimeline } from "@/server/services/intelligenceCenterService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ contractorId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    const { contractorId } = await context.params;

    if (actor.role === "contractor") {
      assertCanAccessContractor(actor, contractorId);
    } else {
      assertPrivilegedRole(actor);
    }

    const timeline = await getContractorTimeline(contractorId);
    return NextResponse.json({ timeline }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[intelligence-center] contractor timeline failed", error);
    return NextResponse.json({ error: "Contractor timeline unavailable" }, { status: 500 });
  }
}
