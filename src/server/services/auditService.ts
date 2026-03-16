import { buildAuditModuleDashboard } from "@/lib/audit/auditDashboard";
import type { AuthorizedUser } from "@/lib/server/authz";
import { listAuditLogs } from "@/server/services/auditLogService";
import {
  listAuditFindings,
  listAuditProjects,
  listAuditTasks,
} from "@/server/services/auditManagementService";
import type { AuditLogEntry } from "@/types/auditLog";
import type { AuditModuleDashboardMetrics, AuditTask, AuditFinding } from "@/types/audit";

function isAuditEntityType(value: string): value is "auditProject" | "auditTask" | "auditFinding" {
  return value === "auditProject" || value === "auditTask" || value === "auditFinding";
}

export async function getAuditModuleDashboardMetrics(
  _actor?: AuthorizedUser,
): Promise<AuditModuleDashboardMetrics> {
  const projects = await listAuditProjects();
  const childCollections = await Promise.all(
    projects.map(async (project) => {
      const [tasks, findings] = await Promise.all([
        listAuditTasks(project.id),
        listAuditFindings(project.id),
      ]);

      return { tasks, findings };
    }),
  );

  const tasks: AuditTask[] = childCollections.flatMap((entry) => entry.tasks);
  const findings: AuditFinding[] = childCollections.flatMap((entry) => entry.findings);

  return buildAuditModuleDashboard(projects, tasks, findings);
}

export async function listAuditModuleLogs(filters?: {
  userId?: string;
  entityId?: string;
  entityType?: "auditProject" | "auditTask" | "auditFinding";
}): Promise<AuditLogEntry[]> {
  if (filters?.entityType && isAuditEntityType(filters.entityType)) {
    return listAuditLogs(filters);
  }

  const logs = await listAuditLogs({
    userId: filters?.userId,
    entityId: filters?.entityId,
  });

  return logs.filter((log) => isAuditEntityType(log.entityType));
}
