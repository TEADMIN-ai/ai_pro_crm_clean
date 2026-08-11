import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { approveClientQuote } from "@/server/services/clientQuoteAuthorityService";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ clientQuoteId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    const { clientQuoteId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const quote = await approveClientQuote({ clientQuoteId, actor, generatedDocumentId: typeof body.generatedDocumentId === "string" ? body.generatedDocumentId : null, overrideReason: typeof body.overrideReason === "string" ? body.overrideReason : null });
    return NextResponse.json({ quote });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Client Quote approval failed", code: (error as { code?: string })?.code }, { status: (error as { status?: number })?.status ?? 500 });
  }
}
