import { NextRequest, NextResponse } from "next/server";
import { FirestoreMasterDataRepository, actorFromAuthorizedUser, isMasterDataEntityType, updateCanonicalMasterDataEntity } from "@/lib/master-data";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Master Data archive failed." }, { status });
}

export async function POST(request: NextRequest, context: { params: Promise<{ entityType: string; canonicalId: string }> }) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const { entityType, canonicalId } = await context.params;
    if (!isMasterDataEntityType(entityType)) return NextResponse.json({ error: "Unsupported entity type." }, { status: 400 });
    const repository = new FirestoreMasterDataRepository();
    const previous = await repository.getByCanonicalId(entityType, canonicalId);
    if (!previous) return NextResponse.json({ error: "Master Data entity not found." }, { status: 404 });
    if (user.workspaceId && user.workspaceId !== previous.workspaceId) return NextResponse.json({ error: "Cross-workspace access rejected." }, { status: 403 });
    const result = await updateCanonicalMasterDataEntity({
      actor: actorFromAuthorizedUser(user),
      repository,
      entityType,
      canonicalId,
      patch: { status: "archived", verificationStatus: "ARCHIVED", reviewStatus: "ARCHIVED" },
      reason: "Master Data API archive.",
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
