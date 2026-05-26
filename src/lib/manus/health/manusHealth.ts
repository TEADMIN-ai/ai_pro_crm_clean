import { getFirebaseAdmin } from "@/lib/firebase/admin";

type WorkflowRow = {
  id: string;
  status?: unknown;
  executionDurationMs?: unknown;
  errors?: unknown;
  steps?: unknown;
};

type WorkflowStatus = "completed" | "failed" | "partial_success" | "cancelled" | "running" | "queued" | "partial";

export async function getManusHealthSummary() {
  const snapshot = await getFirebaseAdmin().collection("manusWorkflows").limit(100).get();
  const rows: WorkflowRow[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  }));
  const total = rows.length;
  const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
    const status = typeof row.status === "string" ? row.status : "unknown";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  const durations = rows
    .map((row) => (typeof row.executionDurationMs === "number" ? row.executionDurationMs : null))
    .filter((value): value is number => typeof value === "number");
  const avgExecutionTimeMs =
    durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;

  const completed = (byStatus.completed ?? 0) + (byStatus.partial_success ?? 0);
  const failed = byStatus.failed ?? 0;
  const timeouts = rows.filter(
    (row) =>
      Array.isArray(row.errors) &&
      row.errors.some((value) => String(value).toLowerCase().includes("timed out"))
  ).length;

  const agentReliability = rows.reduce<Record<string, { success: number; total: number }>>((acc, row) => {
    const steps = Array.isArray(row.steps) ? row.steps : [];
    for (const step of steps) {
      if (!step || typeof step !== "object") {
        continue;
      }
      const actor = typeof (step as { actor?: unknown }).actor === "string" ? String((step as { actor?: unknown }).actor) : "system";
      const status = typeof (step as { status?: unknown }).status === "string" ? String((step as { status?: unknown }).status) : "unknown";
      acc[actor] = acc[actor] ?? { success: 0, total: 0 };
      acc[actor].total += 1;
      if (status === "completed") {
        acc[actor].success += 1;
      }
    }
    return acc;
  }, {});

  return {
    totalWorkflows: total,
    successRate: total > 0 ? Number((completed / total).toFixed(2)) : 0,
    failureRate: total > 0 ? Number((failed / total).toFixed(2)) : 0,
    timeoutRate: total > 0 ? Number((timeouts / total).toFixed(2)) : 0,
    averageExecutionTimeMs: avgExecutionTimeMs,
    statusBreakdown: byStatus as Record<WorkflowStatus | "unknown", number>,
    agentReliability,
  };
}
