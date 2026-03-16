import { NextRequest, NextResponse } from "next/server";
import { assertCanEditAuditModule, assertCanViewAuditModule } from "@/lib/audit/auditPermissions";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { createAuditTask, listAuditTasks } from "@/server/services/auditManagementService";

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
    const tasks = await listAuditTasks(projectId);
    return NextResponse.json({ tasks }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch audit tasks:", error);
    return NextResponse.json({ error: "Failed to fetch audit tasks" }, { status: 500 });
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
    const title = getString(body.title);
    const description = getString(body.description);
    const assignedTo = getString(body.assignedTo) || getString(body.assignee);
    const dueDate = getString(body.dueDate);
    const status = getString(body.status) || "todo";

    if (!title || !description || !assignedTo || !dueDate) {
      return NextResponse.json({ error: "title, description, assignedTo, and dueDate are required" }, { status: 400 });
    }

    const task = await createAuditTask(
      projectId,
      { title, description, assignedTo, dueDate, status: status as "todo" | "in_progress" | "done" | "blocked" },
      actor,
    );

    if (!task) {
      return NextResponse.json({ error: "Audit project not found" }, { status: 404 });
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to create audit task:", error);
    return NextResponse.json({ error: "Failed to create audit task" }, { status: 500 });
  }
}
