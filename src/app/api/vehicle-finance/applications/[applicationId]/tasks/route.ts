export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";

type FirestoreTask = {
  taskId?: string;
  applicationId?: string;
  stageId?: string;
  title?: string;
  description?: string;
  assignedUser?: string | null;
  assignedUserName?: string | null;
  priority?: string;
  dueDate?: string;
  status?: string;
  escalationRule?: string;
  reminderRule?: string;
  completionDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function toIso(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ applicationId: string }> },
) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);
    const { applicationId } = await context.params;
    const snapshot = await getFirebaseAdmin().collection("vehicleFinanceWorkflowTasks").where("applicationId", "==", applicationId).get();
    const tasks = snapshot.docs
      .map((doc) => ({ taskId: doc.id, ...(doc.data() ?? {}) } as FirestoreTask))
      .map((task) => ({
        taskId: task.taskId ?? "",
        applicationId: task.applicationId ?? applicationId,
        stageId: task.stageId ?? "new-application",
        title: task.title ?? "Operational Task",
        description: task.description ?? "",
        assignedUser: task.assignedUser ?? null,
        assignedUserName: task.assignedUserName ?? null,
        priority: task.priority ?? "NORMAL",
        dueDate: toIso(task.dueDate),
        status: task.status ?? "open",
        escalationRule: task.escalationRule ?? "",
        reminderRule: task.reminderRule ?? "",
        completionDate: task.completionDate ?? null,
        createdAt: toIso(task.createdAt),
        updatedAt: toIso(task.updatedAt),
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return NextResponse.json({
      applicationId,
      count: tasks.length,
      overdueCount: tasks.filter((task) => task.status !== "done" && Date.parse(task.dueDate) < Date.now()).length,
      tasks,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[vehicle-finance] task list failed", error);
    return NextResponse.json({ error: "Vehicle finance tasks unavailable" }, { status: 500 });
  }
}
