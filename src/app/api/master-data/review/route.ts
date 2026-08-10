import { NextRequest, NextResponse } from "next/server";
import { FirestoreMasterDataRepository, buildMasterDataReviewQueues } from "@/lib/master-data";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Master Data review queue failed." }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const workspaceId = request.nextUrl.searchParams.get("workspaceId") ?? user.workspaceId;
    if (!workspaceId) return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
    if (user.workspaceId && user.workspaceId !== workspaceId) return NextResponse.json({ error: "Cross-workspace access rejected." }, { status: 403 });

    const queues = await buildMasterDataReviewQueues({
      repository: new FirestoreMasterDataRepository(),
      workspaceId,
    });
    return NextResponse.json(queues);
  } catch (error) {
    return jsonError(error);
  }
}
