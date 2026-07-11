export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

function toIso(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);

    const unreadOnly = request.nextUrl.searchParams.get("unreadOnly") === "1";
    const snapshot = await getFirebaseAdmin().collection("vehicleFinanceNotifications").limit(200).get();
    const notifications = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) } as Record<string, unknown>))
      .map((record) => ({
        id: String(record.id),
        applicationId: typeof record.applicationId === "string" ? record.applicationId : null,
        title: typeof record.title === "string" ? record.title : "Notification",
        message: typeof record.message === "string" ? record.message : "",
        channel: typeof record.channel === "string" ? record.channel : "dashboard",
        audience: Array.isArray(record.audience) ? record.audience.filter((entry) => typeof entry === "string") : [],
        unread: record.unread !== false,
        priority: typeof record.priority === "string" ? record.priority : "NORMAL",
        createdAt: toIso(record.createdAt),
        updatedAt: toIso(record.updatedAt),
        readAt: typeof record.readAt === "string" ? record.readAt : null,
        actorId: typeof record.actorId === "string" ? record.actorId : null,
        actorName: typeof record.actorName === "string" ? record.actorName : null,
        actorRole: typeof record.actorRole === "string" ? record.actorRole : null,
        metadata: record.metadata && typeof record.metadata === "object" ? (record.metadata as Record<string, unknown>) : {},
      }))
      .filter((notification) => (unreadOnly ? notification.unread : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return NextResponse.json({
      unreadCount: notifications.filter((notification) => notification.unread).length,
      notifications,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[vehicle-finance] notifications fetch failed", error);
    return NextResponse.json({ error: "Vehicle finance notifications unavailable" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);

    const body = (await request.json().catch(() => null)) as { notificationId?: string; markAllRead?: boolean } | null;
    const db = getFirebaseAdmin();

    if (body?.markAllRead) {
      const snapshot = await db.collection("vehicleFinanceNotifications").where("unread", "==", true).limit(200).get();
      const batch = db.batch();
      const updatedAt = new Date().toISOString();
      snapshot.docs.forEach((doc) => {
        batch.set(doc.ref, { unread: false, readAt: updatedAt, updatedAt }, { merge: true });
      });
      await batch.commit();
      return NextResponse.json({ updated: snapshot.size, unreadCount: 0 });
    }

    if (!body?.notificationId) {
      return NextResponse.json({ error: "Missing notificationId" }, { status: 400 });
    }

    const ref = db.collection("vehicleFinanceNotifications").doc(body.notificationId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    const updatedAt = new Date().toISOString();
    await ref.set({ unread: false, readAt: updatedAt, updatedAt }, { merge: true });
    return NextResponse.json({ notificationId: body.notificationId, unread: false, readAt: updatedAt });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[vehicle-finance] notification update failed", error);
    return NextResponse.json({ error: "Vehicle finance notification update failed" }, { status: 500 });
  }
}
