import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { createClientQuoteDraft } from "@/server/services/clientQuoteAuthorityService";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const body = await request.json().catch(() => ({}));
    if (typeof body.opportunityId !== "string" || !Array.isArray(body.lines)) return NextResponse.json({ error: "opportunityId and lines are required" }, { status: 400 });
    const quote = await createClientQuoteDraft({ opportunityId: body.opportunityId, actor, lines: body.lines, generatedDocumentId: typeof body.generatedDocumentId === "string" ? body.generatedDocumentId : null });
    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Client Quote could not be created", code: (error as { code?: string })?.code, blockers: (error as { blockers?: unknown })?.blockers }, { status: (error as { status?: number })?.status ?? 500 });
  }
}
