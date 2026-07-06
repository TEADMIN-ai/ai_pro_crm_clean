export const WORKSPACE_TYPES = ['TORQUE_EMPIRE','ROAR_CARS','HYGIENE','PROCUREMENT','CLIENT','PARTNER','INTERNAL','DEVELOPMENT'] as const;
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];
export const WORKSPACE_STATUSES = ['ACTIVE','SUSPENDED','ARCHIVED'] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];
export interface Workspace {
  workspaceId: string;
  slug: string;
  name: string;
  displayName: string;
  type: WorkspaceType;
  status: WorkspaceStatus;
  ownerId: string;
  createdAt: unknown;
  updatedAt: unknown;
}
export interface WorkspaceSummary {
  id: string;
  slug: string;
  displayName: string;
  type: WorkspaceType;
  status: WorkspaceStatus;
}
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
export const isWorkspaceType = (value: unknown): value is WorkspaceType => typeof value === 'string' && WORKSPACE_TYPES.includes(value as WorkspaceType);
export const isWorkspaceStatus = (value: unknown): value is WorkspaceStatus => typeof value === 'string' && WORKSPACE_STATUSES.includes(value as WorkspaceStatus);
export const isWorkspaceSummary = (value: unknown): value is WorkspaceSummary => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return isNonEmptyString(candidate.id) && isNonEmptyString(candidate.slug) && isNonEmptyString(candidate.displayName) && isWorkspaceType(candidate.type) && isWorkspaceStatus(candidate.status);
};
export const normalizeWorkspaceSummary = (value: unknown): WorkspaceSummary | null => {
  if (!isWorkspaceSummary(value)) return null;
  return { id: value.id.trim(), slug: value.slug.trim(), displayName: value.displayName.trim(), type: value.type, status: value.status };
};
export const toWorkspaceSummary = (workspace: Workspace): WorkspaceSummary => ({ id: workspace.workspaceId, slug: workspace.slug, displayName: workspace.displayName, type: workspace.type, status: workspace.status });
