import type { AuditFinding, AuditProjectSummary, AuditTask } from "@/types/audit";

export function buildAuditProjectSummary(tasks: AuditTask[], findings: AuditFinding[]): AuditProjectSummary {
  return {
    taskCount: tasks.length,
    openTaskCount: tasks.filter((task) => task.status !== "done").length,
    findingCount: findings.length,
    openFindingCount: findings.filter((finding) => finding.status !== "resolved" && finding.status !== "closed").length,
    criticalFindingCount: findings.filter((finding) => finding.severity === "critical").length,
  };
}
