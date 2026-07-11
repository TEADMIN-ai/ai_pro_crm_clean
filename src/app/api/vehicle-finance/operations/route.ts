export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertVehicleFinanceRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getVehicleFinanceOverview } from "@/lib/vehicleFinance/vehicleFinanceService";
import { summarizeVehicleFinanceTasks } from "@/lib/vehicle-finance/operations/vehicleFinanceOperations";

type FirestoreTask = {
  applicationId: string;
  status?: string;
  dueDate?: string;
  priority?: string;
  assignedUserName?: string | null;
  title?: string;
  stageId?: string;
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

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    assertVehicleFinanceRole(user);

    const [overview, taskSnapshot, notificationSnapshot] = await Promise.all([
      getVehicleFinanceOverview(),
      getFirebaseAdmin().collection("vehicleFinanceWorkflowTasks").limit(500).get(),
      getFirebaseAdmin().collection("vehicleFinanceNotifications").limit(250).get(),
    ]);

    const tasks = taskSnapshot.docs.map((doc) => ({ applicationId: doc.id, ...(doc.data() ?? {}) } as FirestoreTask));
    const notifications = notificationSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) } as Record<string, unknown>));
    const unreadNotifications = notifications.filter((notification) => notification.unread !== false).length;
    const taskSummary = summarizeVehicleFinanceTasks(
      tasks.map((task) => ({
        taskId: `${task.applicationId}:${task.title ?? "task"}`,
        applicationId: task.applicationId,
        stageId: (task.stageId as any) ?? "new-application",
        title: task.title ?? "Operational Task",
        description: task.title ?? "Operational Task",
        assignedUser: null,
        assignedUserName: task.assignedUserName ?? null,
        priority: (task.priority as any) ?? "NORMAL",
        dueDate: toIso(task.dueDate),
        status: (task.status as any) ?? "open",
        escalationRule: "",
        reminderRule: "",
        completionDate: null,
        auditTrail: [],
        createdAt: toIso(task.createdAt),
        updatedAt: toIso(task.updatedAt),
      })),
    );

    const applications = overview.applications;
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const todayApplications = applications.filter((application) => application.createdAt.slice(0, 10) === todayIso).length;
    const awaitingAssignment = applications.filter((application) => !application.assignedConsultantUid && application.workflowSnapshot?.status !== "completed").length;
    const awaitingDocuments = applications.filter((application) => (application.workflowSnapshot?.aiDocumentCompleteness ?? 0) < 100).length;
    const awaitingBank = applications.filter((application) => /bank-submission|awaiting-bank-decision/i.test(application.workflowStageId ?? "")).length;
    const approvalsToday = applications.filter((application) => application.updatedAt.slice(0, 10) === todayIso && (application.applicationStatus === "VERIFIED" || application.workflowStageId === "approved")).length;
    const declines = applications.filter((application) => application.applicationStatus === "REJECTED" || application.workflowStageId === "declined").length;
    const approvedApplications = applications.filter((application) => application.applicationStatus === "VERIFIED" || application.workflowStageId === "approved");
    const closedApplications = applications.filter((application) => application.workflowStageId === "deal-closed");
    const averageApprovalTime = approvedApplications.length
      ? Math.round(
          approvedApplications.reduce((total, application) => {
            const created = Date.parse(application.createdAt);
            const updated = Date.parse(application.updatedAt);
            return total + Math.max(0, updated - created);
          }, 0) / approvedApplications.length / (1000 * 60 * 60),
        )
      : 0;
    const averageDealTime = closedApplications.length
      ? Math.round(
          closedApplications.reduce((total, application) => {
            const created = Date.parse(application.createdAt);
            const updated = Date.parse(application.updatedAt);
            return total + Math.max(0, updated - created);
          }, 0) / closedApplications.length / (1000 * 60 * 60),
        )
      : 0;
    const consultantPerformance = Array.from(
      applications.reduce((map, application) => {
        const key = application.assignedConsultantName ?? "Unassigned";
        const current = map.get(key) ?? { consultant: key, applications: 0, approved: 0, overdue: 0 };
        current.applications += 1;
        if (application.applicationStatus === "VERIFIED" || application.workflowStageId === "approved") {
          current.approved += 1;
        }
        map.set(key, current);
        return map;
      }, new Map<string, { consultant: string; applications: number; approved: number; overdue: number }>()),
    ).sort((left, right) => right[1].approved - left[1].approved).map(([, value]) => value);
    const workflowBottlenecks = Array.from(
      applications.reduce((map, application) => {
        const stage = application.workflowStageLabel ?? application.workflowStageId ?? "New Application";
        map.set(stage, (map.get(stage) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    )
      .map(([stage, count]) => ({ stage, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);

    return NextResponse.json({
      overview,
      metrics: {
        todayApplications,
        awaitingAssignment,
        awaitingDocuments,
        awaitingBank,
        approvalsToday,
        declines,
        averageApprovalTimeHours: averageApprovalTime,
        averageDealTimeHours: averageDealTime,
        overdueTasks: taskSummary.overdueCount,
        workflowBottlenecks,
        consultantPerformance,
        unreadNotifications,
      },
      taskSummary,
      unreadNotifications,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[vehicle-finance] operations summary failed", error);
    return NextResponse.json({ error: "Vehicle finance operations unavailable" }, { status: 500 });
  }
}
