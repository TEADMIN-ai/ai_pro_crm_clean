import { NextRequest, NextResponse } from "next/server";
import { assertCanEditAuditModule, assertCanViewAuditModule } from "@/lib/audit/auditPermissions";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createAuditFinding, listAuditFindings } from "@/server/services/auditManagementService";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanViewAuditModule(actor);

    const { projectId } = await context.params;
    const findings = await listAuditFindings(projectId);
    return NextResponse.json({ findings }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch audit findings:", error);
    return NextResponse.json({ error: "Failed to fetch audit findings" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanEditAuditModule(actor);

    const { projectId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const description = getString(body.description);
    const severity = getString(body.severity) || "low";
    const recommendation = getString(body.recommendation);
    const status = getString(body.status) || "open";

    if (!description || !recommendation) {
      return NextResponse.json({ error: "description and recommendation are required" }, { status: 400 });
    }

    const finding = await createAuditFinding(
      projectId,
      {
        description,
        severity: severity as "low" | "medium" | "high" | "critical",
        recommendation,
        status: status as "open" | "in_review" | "resolved" | "closed",
      },
      actor,
    );

    if (!finding) {
      return NextResponse.json({ error: "Audit project not found" }, { status: 404 });
    }

    return NextResponse.json({ finding }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to create audit finding:", error);
    return NextResponse.json({ error: "Failed to create audit finding" }, { status: 500 });
  }
}
