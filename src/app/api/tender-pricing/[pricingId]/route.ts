import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import {
  approveTenderPricingWorkspace,
  generateTenderPricingDocument,
  lockTenderPricingWorkspace,
  sendTenderPricingToSubmissionReview,
  updateTenderPricingWorkspace,
  validateTenderPricing,
} from "@/server/services/tenderPricingService";

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

function actionRole(value: unknown): "staff" | "manager" | "director" | undefined {
  return value === "staff" || value === "manager" || value === "director" ? value : undefined;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ pricingId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { pricingId } = await context.params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ pricing: await updateTenderPricingWorkspace({ pricingId, actor, body }) });
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Tender pricing could not be updated.", statusFromError(error));
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ pricingId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { pricingId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    const notes = typeof body.notes === "string" ? body.notes : null;

    if (action === "approve") {
      return NextResponse.json({ pricing: await approveTenderPricingWorkspace({ pricingId, actor, role: actionRole(body.role), notes }) });
    }
    if (action === "generate_document") {
      return NextResponse.json({ pricing: await generateTenderPricingDocument({ pricingId, actor }) });
    }
    if (action === "validate") {
      return NextResponse.json({ pricing: await validateTenderPricing({ pricingId, actor }) });
    }
    if (action === "lock") {
      return NextResponse.json({ pricing: await lockTenderPricingWorkspace({ pricingId, actor }) });
    }
    if (action === "send_submission_review") {
      return NextResponse.json({ pricing: await sendTenderPricingToSubmissionReview({ pricingId, actor }) });
    }

    return jsonError("Unsupported tender pricing action.", 400);
  } catch (error) {
    if (error instanceof AuthorizationError) return jsonError(error.message, error.status);
    return jsonError(error instanceof Error ? error.message : "Tender pricing action failed.", statusFromError(error));
  }
}
