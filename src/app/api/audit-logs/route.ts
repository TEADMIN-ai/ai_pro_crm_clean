import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { listAuditLogs, recordAuditLog } from "@/server/services/auditLogService";
import type { AuditLogAction, AuditLogEntityType } from "@/types/auditLog";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);

    const { searchParams } = new URL(request.url);
    const logs = await listAuditLogs({
      userId: getString(searchParams.get("userId")),
      action: getString(searchParams.get("action")) as AuditLogAction,
      entityType: getString(searchParams.get("entityType")) as AuditLogEntityType,
      entityId: getString(searchParams.get("entityId")),
    });

    return NextResponse.json({ logs }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuthorizedUser(request);
    assertPrivilegedRole(actor);

    const body = (await request.json()) as Record<string, unknown>;
    const userId = getString(body.userId) || actor.uid;
    const action = getString(body.action) as AuditLogAction;
    const entityType = getString(body.entityType) as AuditLogEntityType;
    const entityId = getString(body.entityId);
    const metadata =
      body.metadata && typeof body.metadata === "object" ? (body.metadata as Record<string, unknown>) : undefined;

    if (!action || !entityType || !entityId) {
      return NextResponse.json({ error: "action, entityType, and entityId are required" }, { status: 400 });
    }

    const log = await recordAuditLog({
      userId,
      action,
      entityType,
      entityId,
      metadata,
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to record audit log:", error);
    return NextResponse.json({ error: "Failed to record audit log" }, { status: 500 });
  }
}
