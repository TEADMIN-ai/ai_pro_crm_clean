import { NextRequest, NextResponse } from "next/server";
import { assertCanEditAuditModule, assertCanViewAuditModule } from "@/lib/audit/auditPermissions";
import { buildAuditProjectSummary } from "@/lib/audit/auditSummary";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import {
  deleteAuditProject,
  getAuditProjectById,
  listAuditFindings,
  listAuditTasks,
  updateAuditProject,
} from "@/server/services/auditManagementService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanViewAuditModule(actor);

    const { projectId } = await context.params;
    const project = await getAuditProjectById(projectId);

    if (!project) {
      return NextResponse.json({ error: "Audit project not found" }, { status: 404 });
    }

    const [tasks, findings] = await Promise.all([listAuditTasks(projectId), listAuditFindings(projectId)]);
    return NextResponse.json({ project, tasks, findings, summary: buildAuditProjectSummary(tasks, findings) }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch audit project:", error);
    return NextResponse.json({ error: "Failed to fetch audit project" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanEditAuditModule(actor);

    const { projectId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const project = await updateAuditProject(projectId, body, actor);

    if (!project) {
      return NextResponse.json({ error: "Audit project not found" }, { status: 404 });
    }

    return NextResponse.json({ project }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to update audit project:", error);
    return NextResponse.json({ error: "Failed to update audit project" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanEditAuditModule(actor);

    const { projectId } = await context.params;
    const deleted = await deleteAuditProject(projectId, actor);

    if (!deleted) {
      return NextResponse.json({ error: "Audit project not found" }, { status: 404 });
    }

    return NextResponse.json({ project: deleted }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to delete audit project:", error);
    return NextResponse.json({ error: "Failed to delete audit project" }, { status: 500 });
  }
}
