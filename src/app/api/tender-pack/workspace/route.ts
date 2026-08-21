import { NextRequest, NextResponse } from "next/server";

import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getTenderPackWorkspaceState } from "@/server/services/tenderPackWorkspaceService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    const dealId = request.nextUrl.searchParams.get("dealId")?.trim() ?? "";
    const state = await getTenderPackWorkspaceState({ dealId, actor });
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tender Pack workspace unavailable" }, { status });
  }
}
