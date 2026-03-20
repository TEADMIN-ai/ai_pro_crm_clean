import { buildAuditProjectSummary } from "@/lib/audit/auditSummary";
import type { AuditFinding, AuditTask } from "@/types/audit";

describe("buildAuditProjectSummary", () => {
  test("summarizes audit tasks and findings", () => {
    const tasks: AuditTask[] = [
      { id: "1", auditProjectId: "p1", title: "Plan scope", description: "", assignedTo: "system", assignee: "Lead", dueDate: "2026-03-01", status: "todo" },
      { id: "2", auditProjectId: "p1", title: "Collect evidence", description: "", assignedTo: "Lead", assignee: "Lead", dueDate: "2026-03-02", status: "in_progress" },
      { id: "3", auditProjectId: "p1", title: "Close workpaper", description: "", assignedTo: "Lead", assignee: "Lead", dueDate: "2026-03-03", status: "done" },
    ];

    const findings: AuditFinding[] = [
      { id: "1", auditProjectId: "p1", description: "Access control gap", severity: "critical", recommendation: "Review IAM", status: "open" },
      { id: "2", auditProjectId: "p1", description: "Missing evidence", severity: "medium", recommendation: "Retain logs", status: "resolved" },
      { id: "3", auditProjectId: "p1", description: "Policy stale", severity: "low", recommendation: "Update policy", status: "in_review" },
    ];

    expect(buildAuditProjectSummary(tasks, findings)).toEqual({
      taskCount: 3,
      openTaskCount: 2,
      findingCount: 3,
      openFindingCount: 2,
      criticalFindingCount: 1,
    });
  });
});
