import { NextRequest, NextResponse } from "next/server";
import { assertCanEditAuditModule, assertCanViewAuditModule } from "@/lib/audit/auditPermissions";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { deleteAuditFinding, getAuditFindingById, updateAuditFinding } from "@/server/services/auditManagementService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; findingId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanViewAuditModule(actor);

    const { projectId, findingId } = await context.params;
    const finding = await getAuditFindingById(projectId, findingId);

    if (!finding) {
      return NextResponse.json({ error: "Audit finding not found" }, { status: 404 });
    }

    return NextResponse.json({ finding }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch audit finding:", error);
    return NextResponse.json({ error: "Failed to fetch audit finding" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; findingId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanEditAuditModule(actor);

    const { projectId, findingId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const finding = await updateAuditFinding(projectId, findingId, body, actor);

    if (!finding) {
      return NextResponse.json({ error: "Audit finding not found" }, { status: 404 });
    }

    return NextResponse.json({ finding }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to update audit finding:", error);
    return NextResponse.json({ error: "Failed to update audit finding" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; findingId: string }> },
) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanEditAuditModule(actor);

    const { projectId, findingId } = await context.params;
    const deleted = await deleteAuditFinding(projectId, findingId, actor);

    if (!deleted) {
      return NextResponse.json({ error: "Audit finding not found" }, { status: 404 });
    }

    return NextResponse.json({ finding: deleted }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to delete audit finding:", error);
    return NextResponse.json({ error: "Failed to delete audit finding" }, { status: 500 });
  }
}
