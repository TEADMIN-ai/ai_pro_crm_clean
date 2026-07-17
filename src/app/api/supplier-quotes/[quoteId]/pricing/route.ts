import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import {
  getApprovedSupplierQuotePricing,
  sendApprovedSupplierQuoteToPricing,
} from "@/server/services/supplierQuoteService";

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
    return NextResponse.json({ pricing: await getApprovedSupplierQuotePricing(quoteId, actor) });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier quote pricing could not be loaded.", statusFromError(error));
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { quoteId } = await context.params;
    return NextResponse.json({ pricing: await sendApprovedSupplierQuoteToPricing(quoteId, actor) });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier quote pricing could not be sent.", statusFromError(error));
  }
}
