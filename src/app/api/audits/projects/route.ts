import { NextRequest, NextResponse } from "next/server";
import { assertCanEditAuditModule, assertCanViewAuditModule } from "@/lib/audit/auditPermissions";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createAuditProject, listAuditProjects } from "@/server/services/auditManagementService";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanViewAuditModule(actor);

    const projects = await listAuditProjects();
    return NextResponse.json({ projects }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch audit projects:", error);
    return NextResponse.json({ error: "Failed to fetch audit projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanEditAuditModule(actor);

    const body = (await request.json()) as Record<string, unknown>;
    const title = getString(body.title);
    const department = getString(body.department);
    const startDate = getString(body.startDate);
    const endDate = getString(body.endDate);
    const leadAuditor = getString(body.leadAuditor);
    const status = getString(body.status) || "planned";

    if (!title || !department || !startDate || !endDate || !leadAuditor) {
      return NextResponse.json(
        { error: "title, department, startDate, endDate, and leadAuditor are required" },
        { status: 400 },
      );
    }

    const project = await createAuditProject(
      {
        title,
        department,
        startDate,
        endDate,
        leadAuditor,
        status: status as "planned" | "active" | "completed" | "archived",
      },
      actor,
    );

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to create audit project:", error);
    return NextResponse.json({ error: "Failed to create audit project" }, { status: 500 });
  }
}
