import { buildAuditModuleDashboard } from "@/lib/audit/auditDashboard";
import type { AuditFinding, AuditProject, AuditTask } from "@/types/audit";

describe("buildAuditModuleDashboard", () => {
  test("builds aggregate metrics and per-project health", () => {
    const projects: AuditProject[] = [
      {
        id: "p1",
        title: "Finance Controls",
        department: "Finance",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        leadAuditor: "A. Lead",
        status: "active",
      },
      {
        id: "p2",
        title: "IT Access",
        department: "IT",
        startDate: "2026-03-10",
        endDate: "2026-04-10",
        leadAuditor: "B. Lead",
        status: "planned",
      },
    ];

    const tasks: AuditTask[] = [
      {
        id: "t1",
        auditProjectId: "p1",
        title: "Scope review",
        description: "Define controls in scope",
        assignedTo: "Owner 1",
        dueDate: "2026-03-05T00:00:00.000Z",
        status: "done",
      },
      {
        id: "t2",
        auditProjectId: "p1",
        title: "Evidence request",
        description: "Collect artifacts",
        assignedTo: "Owner 2",
        dueDate: "2026-03-06T00:00:00.000Z",
        status: "in_progress",
      },
      {
        id: "t3",
        auditProjectId: "p2",
        title: "Kickoff",
        description: "Start engagement",
        assignedTo: "Owner 3",
        dueDate: "2026-03-07T00:00:00.000Z",
        status: "todo",
      },
    ];

    const findings: AuditFinding[] = [
      {
        id: "f1",
        auditProjectId: "p1",
        severity: "critical",
        description: "Privilege gap",
        recommendation: "Tighten permissions",
        status: "open",
      },
      {
        id: "f2",
        auditProjectId: "p1",
        severity: "medium",
        description: "Missing evidence",
        recommendation: "Retain logs",
        status: "resolved",
      },
    ];

    expect(
      buildAuditModuleDashboard(projects, tasks, findings, new Date("2026-03-08T00:00:00.000Z")),
    ).toEqual({
      totals: {
        activeAudits: 1,
        openFindings: 1,
        resolvedFindings: 1,
        overdueTasks: 2,
        completionRate: 33,
      },
      projectsByStatus: [
        { status: "active", count: 1 },
        { status: "planned", count: 1 },
      ],
      tasksByStatus: [
        { status: "done", count: 1 },
        { status: "in_progress", count: 1 },
        { status: "todo", count: 1 },
      ],
      findingsBySeverity: [
        { severity: "critical", count: 1 },
        { severity: "medium", count: 1 },
      ],
      projectHealth: [
        {
          projectId: "p1",
          title: "Finance Controls",
          department: "Finance",
          status: "active",
          summary: {
            taskCount: 2,
            openTaskCount: 1,
            findingCount: 2,
            openFindingCount: 1,
            criticalFindingCount: 1,
          },
        },
        {
          projectId: "p2",
          title: "IT Access",
          department: "IT",
          status: "planned",
          summary: {
            taskCount: 1,
            openTaskCount: 1,
            findingCount: 0,
            openFindingCount: 0,
            criticalFindingCount: 0,
          },
        },
      ],
    });
  });
});
