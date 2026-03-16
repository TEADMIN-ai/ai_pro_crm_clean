import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { buildAuditDashboardMetrics } from "@/lib/audit/auditMetrics";
import { buildAuditProjectSummary } from "@/lib/audit/auditSummary";
import type { AuthorizedUser } from "@/lib/server/authz";
import { recordAuditLog } from "@/server/services/auditLogService";
import type {
  AuditDashboardMetrics,
  AuditFinding,
  AuditFindingSeverity,
  AuditFindingStatus,
  AuditProject,
  AuditProjectStatus,
  AuditTask,
  AuditTaskStatus,
} from "@/types/audit";

const AUDIT_PROJECTS_COLLECTION = "auditProjects";

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }

  return undefined;
}

function toIsoDate(value: unknown): string | undefined {
  const millis = toMillis(value);
  if (typeof millis === "number") {
    return new Date(millis).toISOString();
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function asProjectStatus(value: unknown): AuditProjectStatus {
  return value === "active" || value === "completed" || value === "archived" ? value : "planned";
}

function asTaskStatus(value: unknown): AuditTaskStatus {
  return value === "in_progress" || value === "done" || value === "blocked" ? value : "todo";
}

function asFindingSeverity(value: unknown): AuditFindingSeverity {
  if (value === "medium" || value === "high" || value === "critical") {
    return value;
  }

  return "low";
}

function asFindingStatus(value: unknown): AuditFindingStatus {
  if (value === "in_review" || value === "resolved" || value === "closed") {
    return value;
  }

  return "open";
}

function normalizeAuditProject(id: string, data: Record<string, unknown>): AuditProject {
  return {
    id,
    title: asString(data.title, "Untitled audit project"),
    department: asString(data.department),
    startDate: toIsoDate(data.startDate) ?? "",
    endDate: toIsoDate(data.endDate) ?? "",
    leadAuditor: asString(data.leadAuditor),
    status: asProjectStatus(data.status),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
    createdByUid: asString(data.createdByUid) || undefined,
    updatedByUid: asString(data.updatedByUid) || undefined,
  };
}

function normalizeAuditTask(projectId: string, id: string, data: Record<string, unknown>): AuditTask {
  const assignedTo = asString(data.assignedTo) || asString(data.assignee);

  return {
    id,
    auditProjectId: projectId,
    title: asString(data.title, "Untitled audit task"),
    description: asString(data.description),
    assignedTo,
    assignee: assignedTo,
    dueDate: toIsoDate(data.dueDate) ?? "",
    status: asTaskStatus(data.status),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
    createdByUid: asString(data.createdByUid) || undefined,
    updatedByUid: asString(data.updatedByUid) || undefined,
  };
}

function normalizeAuditFinding(projectId: string, id: string, data: Record<string, unknown>): AuditFinding {
  return {
    id,
    auditProjectId: projectId,
    description: asString(data.description),
    severity: asFindingSeverity(data.severity),
    recommendation: asString(data.recommendation),
    status: asFindingStatus(data.status),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
    createdByUid: asString(data.createdByUid) || undefined,
    updatedByUid: asString(data.updatedByUid) || undefined,
  };
}

function getProjectRef(projectId: string) {
  return getFirebaseAdmin().collection(AUDIT_PROJECTS_COLLECTION).doc(projectId);
}

async function ensureProjectExists(projectId: string) {
  const snapshot = await getProjectRef(projectId).get();
  return snapshot.exists;
}

export async function listAuditProjects(): Promise<AuditProject[]> {
  const snapshot = await getFirebaseAdmin().collection(AUDIT_PROJECTS_COLLECTION).orderBy("updatedAt", "desc").get();
  return snapshot.docs.map((doc) => normalizeAuditProject(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
}

export async function getAuditProjectById(projectId: string): Promise<AuditProject | null> {
  const snapshot = await getProjectRef(projectId).get();
  if (!snapshot.exists) {
    return null;
  }

  return normalizeAuditProject(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
}

export async function createAuditProject(
  input: Omit<AuditProject, "id" | "createdAt" | "updatedAt" | "createdByUid" | "updatedByUid">,
  actor: AuthorizedUser,
): Promise<AuditProject> {
  const now = new Date();
  const payload = {
    title: input.title.trim(),
    department: input.department.trim(),
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    leadAuditor: input.leadAuditor.trim(),
    status: asProjectStatus(input.status),
    createdAt: now,
    updatedAt: now,
    createdByUid: actor.uid,
    updatedByUid: actor.uid,
  };

  const docRef = await getFirebaseAdmin().collection(AUDIT_PROJECTS_COLLECTION).add(payload);
  const saved = await docRef.get();
  const project = normalizeAuditProject(saved.id, (saved.data() ?? {}) as Record<string, unknown>);
  await recordAuditLog({
    userId: actor.uid,
    action: "audit_project_created",
    entityType: "auditProject",
    entityId: project.id,
    metadata: {
      title: project.title,
      department: project.department,
      status: project.status,
    },
  });
  return project;
}

export async function updateAuditProject(
  projectId: string,
  updates: Partial<Omit<AuditProject, "id" | "createdAt" | "updatedAt" | "createdByUid" | "updatedByUid">>,
  actor: AuthorizedUser,
): Promise<AuditProject | null> {
  const docRef = getProjectRef(projectId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return null;
  }

  const payload: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedByUid: actor.uid,
  };

  if (typeof updates.title === "string") payload.title = updates.title.trim();
  if (typeof updates.department === "string") payload.department = updates.department.trim();
  if (typeof updates.startDate === "string") payload.startDate = updates.startDate.trim();
  if (typeof updates.endDate === "string") payload.endDate = updates.endDate.trim();
  if (typeof updates.leadAuditor === "string") payload.leadAuditor = updates.leadAuditor.trim();
  if (typeof updates.status === "string") payload.status = asProjectStatus(updates.status);

  await docRef.set(payload, { merge: true });
  const updated = await docRef.get();
  const project = normalizeAuditProject(updated.id, (updated.data() ?? {}) as Record<string, unknown>);
  await recordAuditLog({
    userId: actor.uid,
    action: "audit_project_updated",
    entityType: "auditProject",
    entityId: project.id,
    metadata: {
      title: project.title,
      department: project.department,
      status: project.status,
    },
  });
  return project;
}

export async function deleteAuditProject(projectId: string, actor: AuthorizedUser): Promise<AuditProject | null> {
  const docRef = getProjectRef(projectId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return null;
  }

  const deleted = normalizeAuditProject(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
  const [tasksSnapshot, findingsSnapshot] = await Promise.all([docRef.collection("tasks").get(), docRef.collection("findings").get()]);
  await Promise.all([
    ...tasksSnapshot.docs.map((doc) => doc.ref.delete()),
    ...findingsSnapshot.docs.map((doc) => doc.ref.delete()),
  ]);
  await docRef.delete();
  await recordAuditLog({
    userId: actor.uid,
    action: "audit_project_deleted",
    entityType: "auditProject",
    entityId: deleted.id,
    metadata: {
      title: deleted.title,
      department: deleted.department,
      status: deleted.status,
    },
  });
  return deleted;
}

export async function listAuditTasks(projectId: string): Promise<AuditTask[]> {
  const snapshot = await getProjectRef(projectId).collection("tasks").orderBy("updatedAt", "desc").get();
  return snapshot.docs.map((doc) => normalizeAuditTask(projectId, doc.id, (doc.data() ?? {}) as Record<string, unknown>));
}

export async function getAuditTaskById(projectId: string, taskId: string): Promise<AuditTask | null> {
  const snapshot = await getProjectRef(projectId).collection("tasks").doc(taskId).get();
  if (!snapshot.exists) {
    return null;
  }

  return normalizeAuditTask(projectId, snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
}

export async function createAuditTask(
  projectId: string,
  input: Omit<AuditTask, "id" | "auditProjectId" | "createdAt" | "updatedAt" | "createdByUid" | "updatedByUid">,
  actor: AuthorizedUser,
): Promise<AuditTask | null> {
  if (!(await ensureProjectExists(projectId))) {
    return null;
  }

  const now = new Date();
  const assignedTo = input.assignedTo.trim();
  const payload = {
    title: input.title.trim(),
    description: input.description.trim(),
    assignedTo,
    assignee: assignedTo,
    dueDate: input.dueDate.trim(),
    status: asTaskStatus(input.status),
    createdAt: now,
    updatedAt: now,
    createdByUid: actor.uid,
    updatedByUid: actor.uid,
  };

  const docRef = await getProjectRef(projectId).collection("tasks").add(payload);
  const saved = await docRef.get();
  const task = normalizeAuditTask(projectId, saved.id, (saved.data() ?? {}) as Record<string, unknown>);
  await recordAuditLog({
    userId: actor.uid,
    action: "audit_task_created",
    entityType: "auditTask",
    entityId: task.id,
    metadata: {
      auditProjectId: task.auditProjectId,
      title: task.title,
      status: task.status,
    },
  });
  return task;
}

export async function updateAuditTask(
  projectId: string,
  taskId: string,
  updates: Partial<Omit<AuditTask, "id" | "auditProjectId" | "createdAt" | "updatedAt" | "createdByUid" | "updatedByUid">>,
  actor: AuthorizedUser,
): Promise<AuditTask | null> {
  const docRef = getProjectRef(projectId).collection("tasks").doc(taskId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return null;
  }

  const payload: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedByUid: actor.uid,
  };

  if (typeof updates.title === "string") payload.title = updates.title.trim();
  if (typeof updates.description === "string") payload.description = updates.description.trim();
  if (typeof updates.assignedTo === "string") {
    payload.assignedTo = updates.assignedTo.trim();
    payload.assignee = updates.assignedTo.trim();
  } else if (typeof updates.assignee === "string") {
    payload.assignedTo = updates.assignee.trim();
    payload.assignee = updates.assignee.trim();
  }
  if (typeof updates.dueDate === "string") payload.dueDate = updates.dueDate.trim();
  if (typeof updates.status === "string") payload.status = asTaskStatus(updates.status);

  await docRef.set(payload, { merge: true });
  const updated = await docRef.get();
  const task = normalizeAuditTask(projectId, updated.id, (updated.data() ?? {}) as Record<string, unknown>);
  await recordAuditLog({
    userId: actor.uid,
    action: "audit_task_updated",
    entityType: "auditTask",
    entityId: task.id,
    metadata: {
      auditProjectId: task.auditProjectId,
      title: task.title,
      status: task.status,
    },
  });
  return task;
}

export async function deleteAuditTask(projectId: string, taskId: string, actor: AuthorizedUser): Promise<AuditTask | null> {
  const docRef = getProjectRef(projectId).collection("tasks").doc(taskId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return null;
  }

  const deleted = normalizeAuditTask(projectId, snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
  await docRef.delete();
  await recordAuditLog({
    userId: actor.uid,
    action: "audit_task_deleted",
    entityType: "auditTask",
    entityId: deleted.id,
    metadata: {
      auditProjectId: deleted.auditProjectId,
      title: deleted.title,
      status: deleted.status,
    },
  });
  return deleted;
}

export async function listAuditFindings(projectId: string): Promise<AuditFinding[]> {
  const snapshot = await getProjectRef(projectId).collection("findings").orderBy("updatedAt", "desc").get();
  return snapshot.docs.map((doc) => normalizeAuditFinding(projectId, doc.id, (doc.data() ?? {}) as Record<string, unknown>));
}

export async function getAuditFindingById(projectId: string, findingId: string): Promise<AuditFinding | null> {
  const snapshot = await getProjectRef(projectId).collection("findings").doc(findingId).get();
  if (!snapshot.exists) {
    return null;
  }

  return normalizeAuditFinding(projectId, snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
}

export async function createAuditFinding(
  projectId: string,
  input: Omit<AuditFinding, "id" | "auditProjectId" | "createdAt" | "updatedAt" | "createdByUid" | "updatedByUid">,
  actor: AuthorizedUser,
): Promise<AuditFinding | null> {
  if (!(await ensureProjectExists(projectId))) {
    return null;
  }

  const now = new Date();
  const payload = {
    description: input.description.trim(),
    severity: asFindingSeverity(input.severity),
    recommendation: input.recommendation.trim(),
    status: asFindingStatus(input.status),
    createdAt: now,
    updatedAt: now,
    createdByUid: actor.uid,
    updatedByUid: actor.uid,
  };

  const docRef = await getProjectRef(projectId).collection("findings").add(payload);
  const saved = await docRef.get();
  const finding = normalizeAuditFinding(projectId, saved.id, (saved.data() ?? {}) as Record<string, unknown>);
  await recordAuditLog({
    userId: actor.uid,
    action: "audit_finding_created",
    entityType: "auditFinding",
    entityId: finding.id,
    metadata: {
      auditProjectId: finding.auditProjectId,
      severity: finding.severity,
      status: finding.status,
    },
  });
  return finding;
}

export async function updateAuditFinding(
  projectId: string,
  findingId: string,
  updates: Partial<Omit<AuditFinding, "id" | "auditProjectId" | "createdAt" | "updatedAt" | "createdByUid" | "updatedByUid">>,
  actor: AuthorizedUser,
): Promise<AuditFinding | null> {
  const docRef = getProjectRef(projectId).collection("findings").doc(findingId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return null;
  }

  const payload: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedByUid: actor.uid,
  };

  if (typeof updates.description === "string") payload.description = updates.description.trim();
  if (typeof updates.severity === "string") payload.severity = asFindingSeverity(updates.severity);
  if (typeof updates.recommendation === "string") payload.recommendation = updates.recommendation.trim();
  if (typeof updates.status === "string") payload.status = asFindingStatus(updates.status);

  await docRef.set(payload, { merge: true });
  const updated = await docRef.get();
  const finding = normalizeAuditFinding(projectId, updated.id, (updated.data() ?? {}) as Record<string, unknown>);
  await recordAuditLog({
    userId: actor.uid,
    action: "audit_finding_updated",
    entityType: "auditFinding",
    entityId: finding.id,
    metadata: {
      auditProjectId: finding.auditProjectId,
      severity: finding.severity,
      status: finding.status,
    },
  });
  return finding;
}

export async function deleteAuditFinding(projectId: string, findingId: string, actor: AuthorizedUser): Promise<AuditFinding | null> {
  const docRef = getProjectRef(projectId).collection("findings").doc(findingId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return null;
  }

  const deleted = normalizeAuditFinding(projectId, snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
  await docRef.delete();
  await recordAuditLog({
    userId: actor.uid,
    action: "audit_finding_deleted",
    entityType: "auditFinding",
    entityId: deleted.id,
    metadata: {
      auditProjectId: deleted.auditProjectId,
      severity: deleted.severity,
      status: deleted.status,
    },
  });
  return deleted;
}

export async function getAuditDashboardMetrics(): Promise<AuditDashboardMetrics> {
  const projects = await listAuditProjects();
  const findingsByProject = await Promise.all(projects.map((project) => listAuditFindings(project.id)));
  return buildAuditDashboardMetrics(projects, findingsByProject.flat());
}
