import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertOperationalRole, requireAuthorizedUser } from "@/lib/server/authz";
import { buildRiskMetrics } from "@/lib/risk/riskMetrics";
import {
  deleteRisk,
  getRiskById,
  listRisks,
  updateRisk,
} from "@/server/services/riskService";
import type { RiskStatus } from "@/types/risk";

function validateRiskUpdate(body: Record<string, unknown>): string | null {
  if ("riskScore" in body) {
    const riskScore = body.riskScore;
    if (typeof riskScore !== "number" || !Number.isInteger(riskScore) || riskScore < 1 || riskScore > 5) {
      return "riskScore must be an integer between 1 and 5";
    }
  }

  if ("status" in body) {
    const status = body.status;
    const isValidStatus = status === "open" || status === "monitoring" || status === "mitigated";
    if (!isValidStatus) {
      return "status must be one of open, monitoring, mitigated";
    }
  }

  const stringFields = ["riskTitle", "riskDescription", "riskCategory", "mitigationPlan", "owner"] as const;
  for (const field of stringFields) {
    if (field in body && typeof body[field] !== "string") {
      return `${field} must be a string`;
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ riskId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertOperationalRole(actor);

    const { riskId } = await context.params;
    const risk = await getRiskById(riskId);

    if (!risk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    return NextResponse.json({ risk }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch risk register entry:", error);
    return NextResponse.json({ error: "Failed to fetch risk register entry" }, { status: 500 });
  }
}

async function handleUpdate(
  request: NextRequest,
  context: { params: Promise<{ riskId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertOperationalRole(actor);

    const { riskId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const validationError = validateRiskUpdate(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const risk = await updateRisk(
      riskId,
      body as Partial<{
        riskTitle: string;
        riskDescription: string;
        riskCategory: string;
        riskScore: number;
        mitigationPlan: string;
        owner: string;
        status: RiskStatus;
      }>,
      actor,
    );

    if (!risk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    const risks = await listRisks();
    return NextResponse.json({ risk, summary: buildRiskMetrics(risks) }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to update risk register entry:", error);
    return NextResponse.json({ error: "Failed to update risk register entry" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ riskId: string }> },
) {
  return handleUpdate(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ riskId: string }> },
) {
  return handleUpdate(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ riskId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertOperationalRole(actor);

    const { riskId } = await context.params;
    const deleted = await deleteRisk(riskId, actor);

    if (!deleted) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    const risks = await listRisks();
    return NextResponse.json({ risk: deleted, summary: buildRiskMetrics(risks) }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to delete risk register entry:", error);
    return NextResponse.json({ error: "Failed to delete risk register entry" }, { status: 500 });
  }
}
