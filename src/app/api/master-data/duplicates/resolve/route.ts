import { NextRequest, NextResponse } from "next/server";
import { FirestoreMasterDataRepository, actorFromAuthorizedUser, isMasterDataEntityType, resolveMasterDataDuplicate } from "@/lib/master-data";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import type { DuplicateResolutionOutcome } from "@/lib/master-data/reviewWorkflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTCOMES: readonly DuplicateResolutionOutcome[] = ["same_entity", "different_entities", "review_required"];

function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Master Data duplicate resolution failed." }, { status });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Duplicate resolution payload must be an object." }, { status: 400 });
    const workspaceId = text(body.workspaceId) || user.workspaceId;
    const entityType = text(body.entityType);
    const outcome = text(body.outcome) as DuplicateResolutionOutcome;
    if (!workspaceId) return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
    if (user.workspaceId && user.workspaceId !== workspaceId) return NextResponse.json({ error: "Cross-workspace access rejected." }, { status: 403 });
    if (!isMasterDataEntityType(entityType)) return NextResponse.json({ error: "Supported entityType is required." }, { status: 400 });
    if (!OUTCOMES.includes(outcome)) return NextResponse.json({ error: "Unsupported duplicate resolution outcome." }, { status: 400 });

    const result = await resolveMasterDataDuplicate({
      actor: actorFromAuthorizedUser(user),
      repository: new FirestoreMasterDataRepository(),
      resolution: {
        workspaceId,
        entityType,
        candidateAId: text(body.candidateAId),
        candidateBId: text(body.candidateBId),
        canonicalSurvivorId: text(body.canonicalSurvivorId) || null,
        outcome,
        reason: text(body.reason),
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
