import { NextRequest, NextResponse } from "next/server";
import { assertCanEditAuditModule, assertCanViewAuditModule } from "@/lib/audit/auditPermissions";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { deleteAuditTask, getAuditTaskById, updateAuditTask } from "@/server/services/auditManagementService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; taskId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanViewAuditModule(actor);

    const { projectId, taskId } = await context.params;
    const task = await getAuditTaskById(projectId, taskId);

    if (!task) {
      return NextResponse.json({ error: "Audit task not found" }, { status: 404 });
    }

    return NextResponse.json({ task }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch audit task:", error);
    return NextResponse.json({ error: "Failed to fetch audit task" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; taskId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanEditAuditModule(actor);

    const { projectId, taskId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const task = await updateAuditTask(projectId, taskId, body, actor);

    if (!task) {
      return NextResponse.json({ error: "Audit task not found" }, { status: 404 });
    }

    return NextResponse.json({ task }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to update audit task:", error);
    return NextResponse.json({ error: "Failed to update audit task" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; taskId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanEditAuditModule(actor);

    const { projectId, taskId } = await context.params;
    const deleted = await deleteAuditTask(projectId, taskId, actor);

    if (!deleted) {
      return NextResponse.json({ error: "Audit task not found" }, { status: 404 });
    }

    return NextResponse.json({ task: deleted }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to delete audit task:", error);
    return NextResponse.json({ error: "Failed to delete audit task" }, { status: 500 });
  }
}
