import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity/logActivity";
import { AuthorizationError, assertPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

type AlertRecord = {
  contractorId?: unknown;
  type?: unknown;
  code?: unknown;
  message?: unknown;
  createdAt?: unknown;
  resolved?: unknown;
  resolvedAt?: unknown;
};

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return null;
}

function normalizeAlert(id: string, source: AlertRecord) {
  return {
    id,
    contractorId: typeof source.contractorId === "string" ? source.contractorId : "",
    type: typeof source.type === "string" ? source.type : "WARNING",
    code: typeof source.code === "string" ? source.code : "",
    message: typeof source.message === "string" ? source.message : "Alert",
    createdAt: toIsoString(source.createdAt),
    resolved: source.resolved === true,
    resolvedAt: toIsoString(source.resolvedAt),
  };
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const snapshot = await getFirebaseAdmin()
      .collection("automationAlerts")
      .orderBy("createdAt", "desc")
      .get();

    const alerts = snapshot.docs.map((doc) =>
      normalizeAlert(doc.id, (doc.data() ?? {}) as AlertRecord)
    );

    return NextResponse.json(alerts);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Automation alerts fetch failed:", error);
    return jsonError("Failed to fetch automation alerts", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertPrivilegedRole(user);

    const payload = (await request.json().catch(() => null)) as { alertId?: unknown } | null;
    const alertId = typeof payload?.alertId === "string" ? payload.alertId.trim() : "";

    if (!alertId) {
      return jsonError("alertId is required", 400);
    }

    const alertRef = getFirebaseAdmin().collection("automationAlerts").doc(alertId);
    const snapshot = await alertRef.get();

    if (!snapshot.exists) {
      return jsonError("Alert not found", 404);
    }

    const existing = (snapshot.data() ?? {}) as AlertRecord;

    await alertRef.set(
      {
        resolved: true,
        resolvedAt: new Date(),
      },
      { merge: true }
    );

    if (typeof existing.contractorId === "string" && typeof existing.message === "string") {
      await logActivity({
        contractorId: existing.contractorId,
        action: `Alert resolved: ${existing.message}`,
        performedBy: user.email?.trim() || user.uid,
      });
    }

    const updated = await alertRef.get();

    return NextResponse.json({
      success: true,
      alert: normalizeAlert(updated.id, (updated.data() ?? {}) as AlertRecord),
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Automation alert update failed:", error);
    return jsonError("Failed to update automation alert", 500);
  }
}
