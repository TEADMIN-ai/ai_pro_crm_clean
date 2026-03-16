import { buildAuditDashboardMetrics } from "@/lib/audit/auditMetrics";
import { buildAuditProjectSummary } from "@/lib/audit/auditSummary";
import type {
  AuditFinding,
  AuditModuleDashboardMetrics,
  AuditProject,
  AuditTask,
} from "@/types/audit";

function countByStatus(values: string[]): Array<{ status: string; count: number }> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => left.status.localeCompare(right.status));
}

function countFindingsBySeverity(findings: AuditFinding[]): AuditModuleDashboardMetrics["findingsBySeverity"] {
  const counts = new Map<AuditFinding["severity"], number>();

  for (const finding of findings) {
    counts.set(finding.severity, (counts.get(finding.severity) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([severity, count]) => ({ severity, count }))
    .sort((left, right) => left.severity.localeCompare(right.severity));
}

export function buildAuditModuleDashboard(
  projects: AuditProject[],
  tasks: AuditTask[],
  findings: AuditFinding[],
  now = new Date(),
): AuditModuleDashboardMetrics {
  const totals = buildAuditDashboardMetrics(projects, findings);
  const overdueTasks = tasks.filter((task) => {
    if (task.status === "done") {
      return false;
    }

    const dueAt = Date.parse(task.dueDate);
    return Number.isFinite(dueAt) && dueAt < now.getTime();
  }).length;
  const completionRate = tasks.length > 0
    ? Math.round((tasks.filter((task) => task.status === "done").length / tasks.length) * 100)
    : 0;

  return {
    totals: {
      ...totals,
      overdueTasks,
      completionRate,
    },
    projectsByStatus: countByStatus(projects.map((project) => project.status)),
    tasksByStatus: countByStatus(tasks.map((task) => task.status)),
    findingsBySeverity: countFindingsBySeverity(findings),
    projectHealth: projects.map((project) => ({
      projectId: project.id,
      title: project.title,
      department: project.department,
      status: project.status,
      summary: buildAuditProjectSummary(
        tasks.filter((task) => task.auditProjectId === project.id),
        findings.filter((finding) => finding.auditProjectId === project.id),
      ),
    })),
  };
}
