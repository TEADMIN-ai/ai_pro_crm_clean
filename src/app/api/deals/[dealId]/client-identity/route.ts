import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { createClientCandidateForDeal, linkVerifiedClientToDeal, resolveDealClientIdentity } from "@/server/services/clientIdentityService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
  const status = typeof error === "object" && error && "status" in error && typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
  const code = typeof error === "object" && error && "code" in error ? (error as { code?: unknown }).code : undefined;
  return NextResponse.json({ error: error instanceof Error ? error.message : "Client identity request failed.", code }, { status });
}

export async function GET(request: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { dealId } = await context.params;
    return NextResponse.json({ clientIdentity: await resolveDealClientIdentity({ dealId, actor }) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ dealId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { dealId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "create_candidate") {
      return NextResponse.json(await createClientCandidateForDeal({ dealId, actor }), { status: 201 });
    }
    if (action === "link_verified") {
      const canonicalId = typeof body.canonicalId === "string" ? body.canonicalId.trim() : "";
      if (!canonicalId) return NextResponse.json({ error: "canonicalId is required." }, { status: 400 });
      return NextResponse.json(await linkVerifiedClientToDeal({ dealId, canonicalId, actor, reason: typeof body.reason === "string" ? body.reason : null }));
    }
    return NextResponse.json({ error: "Unsupported client identity action." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}
