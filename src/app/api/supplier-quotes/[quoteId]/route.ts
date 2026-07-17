import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { getSupplierQuote, reviewSupplierQuote } from "@/server/services/supplierQuoteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function statusFromError(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : 500;
}

export async function GET(request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { quoteId } = await context.params;
    return NextResponse.json({ quote: await getSupplierQuote(quoteId, actor) });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier quote could not be loaded.", statusFromError(error));
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { quoteId } = await context.params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ quote: await reviewSupplierQuote(quoteId, body.corrections ?? body, actor) });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier quote could not be reviewed.", statusFromError(error));
  }
}
