import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { decideSupplierQuote } from "@/server/services/supplierQuoteService";

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

export async function POST(request: NextRequest, context: { params: Promise<{ quoteId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { quoteId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "");
    if (!["approve", "reject", "request_clarification"].includes(action)) {
      return jsonError("action must be approve, reject, or request_clarification.", 400);
    }
    const quote = await decideSupplierQuote({
      quoteId,
      actor,
      action: action as "approve" | "reject" | "request_clarification",
      note: typeof body.note === "string" ? body.note : null,
      rejectionReason: typeof body.rejectionReason === "string" ? body.rejectionReason : null,
      clarificationRequest: typeof body.clarificationRequest === "string" ? body.clarificationRequest : null,
      approvedLineItemIds: Array.isArray(body.approvedLineItemIds)
        ? body.approvedLineItemIds.filter((item: unknown): item is string => typeof item === "string")
        : [],
    });
    return NextResponse.json({ quote });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Supplier quote approval could not be recorded.", statusFromError(error));
  }
}
