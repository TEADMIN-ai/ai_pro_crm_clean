import type { AuditDashboardMetrics, AuditFinding, AuditProject } from "@/types/audit";

export function buildAuditDashboardMetrics(
  projects: AuditProject[],
  findings: AuditFinding[],
): AuditDashboardMetrics {
  let openFindings = 0;
  let resolvedFindings = 0;

  for (const finding of findings) {
    if (finding.status === "resolved" || finding.status === "closed") {
      resolvedFindings += 1;
    } else {
      openFindings += 1;
    }
  }

  return {
    activeAudits: projects.filter((project) => project.status === "active").length,
    openFindings,
    resolvedFindings,
  };
}
