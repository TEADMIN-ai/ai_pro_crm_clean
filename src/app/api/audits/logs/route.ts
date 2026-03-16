import { NextRequest, NextResponse } from "next/server";
import { assertCanViewAuditModule } from "@/lib/audit/auditPermissions";
import { AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { listAuditModuleLogs } from "@/server/services/auditService";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asEntityType(value: string): "auditProject" | "auditTask" | "auditFinding" | undefined {
  return value === "auditProject" || value === "auditTask" || value === "auditFinding"
    ? value
    : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertCanViewAuditModule(actor);

    const { searchParams } = new URL(request.url);
    const logs = await listAuditModuleLogs({
      userId: getString(searchParams.get("userId")),
      entityId: getString(searchParams.get("entityId")),
      entityType: asEntityType(getString(searchParams.get("entityType"))),
    });

    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch audit module logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit module logs" }, { status: 500 });
  }
}
