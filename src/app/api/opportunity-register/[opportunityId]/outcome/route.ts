import { NextRequest, NextResponse } from "next/server";

import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { recordProcurementOutcome, type ProcurementOutcomeStatus } from "@/server/services/procurementOutcomeAuthorityService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusFromError(error: unknown): number {
  return typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : 500;
}

function codeFromError(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
}

function normalizeOutcome(value: unknown): ProcurementOutcomeStatus | null {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  return normalized === "AWARDED" || normalized === "UNSUCCESSFUL" || normalized === "CANCELLED"
    ? normalized
    : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ opportunityId: string }> }) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);
    const { opportunityId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const outcome = normalizeOutcome(body.outcome);

    if (!outcome) {
      return NextResponse.json({ error: "Outcome must be AWARDED, UNSUCCESSFUL, or CANCELLED", code: "INVALID_OUTCOME" }, { status: 400 });
    }

    const result = await recordProcurementOutcome({
      dealId: opportunityId,
      actor,
      outcome,
      outcomeEvidenceDocumentId: typeof body.outcomeEvidenceDocumentId === "string" ? body.outcomeEvidenceDocumentId : "",
      reference: typeof body.reference === "string" ? body.reference : null,
      reason: typeof body.reason === "string" ? body.reason : null,
      awardedAmount: typeof body.awardedAmount === "number" ? body.awardedAmount : null,
      actualIncomeReference: typeof body.actualIncomeReference === "string" ? body.actualIncomeReference : null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to record procurement outcome",
        ...(codeFromError(error) ? { code: codeFromError(error) } : {}),
      },
      { status: statusFromError(error) },
    );
  }
}
