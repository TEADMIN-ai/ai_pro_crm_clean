export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

type AssignmentBody = {
  assignedConsultantUid?: string;
  assignedConsultantName?: string;
  assignedSalesManagerUid?: string;
  assignedSalesManagerName?: string;
  assignedFinanceManagerUid?: string;
  assignedFinanceManagerName?: string;
  reason?: string;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const { applicationId } = await context.params;
    const snapshot = await getFirebaseAdmin().collection("vehicleFinanceApplications").doc(applicationId).get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Vehicle finance application not found" }, { status: 404 });
    }

    const data = snapshot.data() ?? {};
    return NextResponse.json({
      applicationId,
      assignedConsultantUid: typeof data.assignedConsultantUid === "string" ? data.assignedConsultantUid : null,
      assignedConsultantName: typeof data.assignedConsultantName === "string" ? data.assignedConsultantName : null,
      assignedSalesManagerUid: typeof data.assignedSalesManagerUid === "string" ? data.assignedSalesManagerUid : null,
      assignedSalesManagerName: typeof data.assignedSalesManagerName === "string" ? data.assignedSalesManagerName : null,
      assignedFinanceManagerUid: typeof data.assignedFinanceManagerUid === "string" ? data.assignedFinanceManagerUid : null,
      assignedFinanceManagerName: typeof data.assignedFinanceManagerName === "string" ? data.assignedFinanceManagerName : null,
      assignmentTimestamp: typeof data.assignmentTimestamp === "string" ? data.assignmentTimestamp : null,
      assignmentHistory: Array.isArray(data.assignmentHistory) ? data.assignmentHistory : [],
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] assignment fetch failed", error);
    return NextResponse.json({ error: "Vehicle finance assignment unavailable" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const { applicationId } = await context.params;
    const body = (await request.json()) as AssignmentBody;
    const db = getFirebaseAdmin();
    const ref = db.collection("vehicleFinanceApplications").doc(applicationId);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json({ error: "Vehicle finance application not found" }, { status: 404 });
    }

    const current = snapshot.data() ?? {};
    const previousValue = {
      assignedConsultantUid: typeof current.assignedConsultantUid === "string" ? current.assignedConsultantUid : null,
      assignedConsultantName: typeof current.assignedConsultantName === "string" ? current.assignedConsultantName : null,
      assignedSalesManagerUid: typeof current.assignedSalesManagerUid === "string" ? current.assignedSalesManagerUid : null,
      assignedSalesManagerName: typeof current.assignedSalesManagerName === "string" ? current.assignedSalesManagerName : null,
      assignedFinanceManagerUid: typeof current.assignedFinanceManagerUid === "string" ? current.assignedFinanceManagerUid : null,
      assignedFinanceManagerName: typeof current.assignedFinanceManagerName === "string" ? current.assignedFinanceManagerName : null,
    };
    const nextValue = {
      assignedConsultantUid: body.assignedConsultantUid?.trim() || null,
      assignedConsultantName: body.assignedConsultantName?.trim() || null,
      assignedSalesManagerUid: body.assignedSalesManagerUid?.trim() || null,
      assignedSalesManagerName: body.assignedSalesManagerName?.trim() || null,
      assignedFinanceManagerUid: body.assignedFinanceManagerUid?.trim() || null,
      assignedFinanceManagerName: body.assignedFinanceManagerName?.trim() || null,
    };
    const assignmentTimestamp = new Date().toISOString();

    await ref.set(
      {
        ...nextValue,
        assignmentTimestamp,
        assignmentHistory: FieldValue.arrayUnion({
          timestamp: assignmentTimestamp,
          actorId: user.uid,
          actorName: user.email ?? user.uid,
          reason: body.reason?.trim() || "Assignment updated",
          previousValue,
          nextValue,
        }),
        updatedAt: assignmentTimestamp,
      },
      { merge: true },
    );

    await db.collection("vehicleFinanceConsultantAssignments").doc(applicationId).set(
      {
        applicationId,
        ...nextValue,
        assignmentTimestamp,
        updatedAt: assignmentTimestamp,
        updatedBy: user.uid,
        updatedByName: user.email ?? user.uid,
        reason: body.reason?.trim() || "Assignment updated",
      },
      { merge: true },
    );

    await db.collection("vehicleFinanceNotifications").doc().set({
      applicationId,
      title: "Consultant Assignment Updated",
      message: `Application ${applicationId} assignment updated.`,
      channel: "dashboard",
      audience: ["operations", "consultant", "manager"],
      unread: true,
      priority: "NORMAL",
      createdAt: assignmentTimestamp,
      updatedAt: assignmentTimestamp,
      readAt: null,
      actorId: user.uid,
      actorName: user.email ?? user.uid,
      actorRole: user.role ?? null,
      metadata: {
        reason: body.reason?.trim() || "Assignment updated",
        nextValue,
      },
    });

    await db.collection("auditLogs").add({
      eventType: "VEHICLE_FINANCE_ASSIGNMENT_UPDATED",
      actorId: user.uid,
      actorRole: user.role ?? null,
      actorName: user.email ?? user.uid,
      applicationId,
      targetId: applicationId,
      previousValue,
      newValue: nextValue,
      timestamp: new Date(),
      metadata: {
        module: "vehicle-finance",
        reason: body.reason?.trim() || "Assignment updated",
      },
    });

    return NextResponse.json({
      applicationId,
      assignmentTimestamp,
      previousValue,
      nextValue,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] assignment update failed", error);
    return NextResponse.json({ error: "Vehicle finance assignment update failed" }, { status: 500 });
  }
}
