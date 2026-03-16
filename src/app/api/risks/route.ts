import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertOperationalRole, requireAuthorizedUser } from "@/lib/server/authz";
import { buildRiskMetrics } from "@/lib/risk/riskMetrics";
import { createRisk, listRisks } from "@/server/services/riskService";
import type { RiskStatus } from "@/types/risk";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStatus(value: unknown): RiskStatus | null {
  return value === "open" || value === "monitoring" || value === "mitigated" ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertOperationalRole(actor);

    const risks = await listRisks();
    return NextResponse.json({ risks, summary: buildRiskMetrics(risks) }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch risk register:", error);
    return NextResponse.json({ error: "Failed to fetch risk register" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertOperationalRole(actor);

    const body = (await request.json()) as Record<string, unknown>;
    const riskTitle = getString(body.riskTitle);
    const riskDescription = getString(body.riskDescription);
    const riskCategory = getString(body.riskCategory);
    const riskScore = getNumber(body.riskScore);
    const mitigationPlan = getString(body.mitigationPlan);
    const owner = getString(body.owner);
    const status = body.status === undefined ? "open" : getStatus(body.status);

    if (!riskTitle || !riskDescription || !riskCategory || riskScore === null || !mitigationPlan || !owner) {
      return NextResponse.json(
        {
          error:
            "riskTitle, riskDescription, riskCategory, riskScore, mitigationPlan, and owner are required",
        },
        { status: 400 },
      );
    }

    if (!Number.isInteger(riskScore) || riskScore < 1 || riskScore > 5) {
      return NextResponse.json({ error: "riskScore must be an integer between 1 and 5" }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ error: "status must be one of open, monitoring, mitigated" }, { status: 400 });
    }

    const risk = await createRisk(
      {
        riskTitle,
        riskDescription,
        riskCategory,
        riskScore,
        mitigationPlan,
        owner,
        status,
      },
      actor,
    );

    const risks = await listRisks();
    return NextResponse.json({ risk, summary: buildRiskMetrics(risks) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to create risk register entry:", error);
    return NextResponse.json({ error: "Failed to create risk register entry" }, { status: 500 });
  }
}
