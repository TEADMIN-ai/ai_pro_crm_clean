import { NextRequest, NextResponse } from "next/server";
import {
  FirestoreMasterDataRepository,
  actorFromAuthorizedUser,
  createCanonicalMasterDataEntity,
  isMasterDataEntityType,
  parseMasterDataEntityPayload,
} from "@/lib/master-data";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Master Data request failed." }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const entityType = request.nextUrl.searchParams.get("entityType");
    const workspaceId = request.nextUrl.searchParams.get("workspaceId") ?? user.workspaceId;
    if (!isMasterDataEntityType(entityType)) return NextResponse.json({ error: "Supported entityType is required." }, { status: 400 });
    if (!workspaceId) return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
    if (user.workspaceId && user.workspaceId !== workspaceId) return NextResponse.json({ error: "Cross-workspace access rejected." }, { status: 403 });
    const repository = new FirestoreMasterDataRepository();
    return NextResponse.json({ records: await repository.listByEntityType(entityType, workspaceId) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const entity = parseMasterDataEntityPayload(await request.json());
    if (user.workspaceId && user.workspaceId !== entity.workspaceId) return NextResponse.json({ error: "Cross-workspace access rejected." }, { status: 403 });
    const repository = new FirestoreMasterDataRepository();
    const result = await createCanonicalMasterDataEntity({
      actor: actorFromAuthorizedUser(user),
      repository,
      entity,
      reason: "Master Data API create.",
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
