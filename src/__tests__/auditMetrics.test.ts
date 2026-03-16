import { buildAuditDashboardMetrics } from "@/lib/audit/auditMetrics";
import type { AuditFinding, AuditProject } from "@/types/audit";

describe("buildAuditDashboardMetrics", () => {
  test("summarizes active audits and finding resolution counts", () => {
    const projects: AuditProject[] = [
      { id: "p1", title: "Finance Q1", department: "Finance", startDate: "2026-03-01", endDate: "2026-03-31", leadAuditor: "A. Lead", status: "active" },
      { id: "p2", title: "HR Access", department: "HR", startDate: "2026-02-01", endDate: "2026-02-28", leadAuditor: "B. Lead", status: "completed" },
      { id: "p3", title: "IT Controls", department: "IT", startDate: "2026-03-10", endDate: "2026-04-10", leadAuditor: "C. Lead", status: "active" },
    ];

    const findings: AuditFinding[] = [
      { id: "f1", auditProjectId: "p1", severity: "high", description: "Gap 1", recommendation: "Fix 1", status: "open" },
      { id: "f2", auditProjectId: "p1", severity: "low", description: "Gap 2", recommendation: "Fix 2", status: "in_review" },
      { id: "f3", auditProjectId: "p2", severity: "medium", description: "Gap 3", recommendation: "Fix 3", status: "resolved" },
      { id: "f4", auditProjectId: "p3", severity: "critical", description: "Gap 4", recommendation: "Fix 4", status: "closed" },
    ];

    expect(buildAuditDashboardMetrics(projects, findings)).toEqual({
      activeAudits: 2,
      openFindings: 2,
      resolvedFindings: 2,
    });
  });
});
