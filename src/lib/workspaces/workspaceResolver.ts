import { getWorkspaceById, getWorkspaceByIdentifier, getWorkspaceBySlug, isWorkspaceArchived, toWorkspaceRegistrySummary } from './workspaceRegistry';
import { normalizeWorkspaceSummary, type WorkspaceSummary } from './workspaceTypes';

export class WorkspaceResolutionError extends Error {
  status = 403;
  constructor(message: string, status = 403) {
    super(message);
    this.name = 'WorkspaceResolutionError';
    this.status = status;
  }
}

export interface WorkspaceResolutionInput {
  workspaceId?: unknown;
  slug?: unknown;
  workspace?: unknown;
  allowArchived?: boolean;
}
function assertWorkspaceIsAllowed(workspace: ReturnType<typeof getWorkspaceByIdentifier>, allowArchived: boolean): WorkspaceSummary {
  if (!workspace) {
    throw new WorkspaceResolutionError('Unknown workspace', 404);
  }
  if (isWorkspaceArchived(workspace) && !allowArchived) {
    throw new WorkspaceResolutionError('Archived workspace is not allowed', 403);
  }
  return toWorkspaceRegistrySummary(workspace)!;
}

export function resolveWorkspaceById(workspaceId: unknown, allowArchived = false): WorkspaceSummary {
  const workspace = getWorkspaceById(workspaceId);
  return assertWorkspaceIsAllowed(workspace, allowArchived);
}

export function resolveWorkspaceBySlug(slug: unknown, allowArchived = false): WorkspaceSummary {
  const workspace = getWorkspaceBySlug(slug);
  return assertWorkspaceIsAllowed(workspace, allowArchived);
}
export function resolveWorkspace(input: WorkspaceResolutionInput): WorkspaceSummary {
  const normalizedWorkspace = normalizeWorkspaceSummary(input.workspace);
  if (normalizedWorkspace) {
    if (normalizedWorkspace.status === 'ARCHIVED' && !input.allowArchived) {
      throw new WorkspaceResolutionError('Archived workspace is not allowed', 403);
    }
    const resolved = getWorkspaceByIdentifier(normalizedWorkspace.id) ?? getWorkspaceBySlug(normalizedWorkspace.slug);
    if (!resolved) {
      throw new WorkspaceResolutionError('Unknown workspace', 404);
    }
    return assertWorkspaceIsAllowed(resolved, Boolean(input.allowArchived));
  }

  if (input.workspaceId !== undefined && input.workspaceId !== null) {
    return resolveWorkspaceById(input.workspaceId, Boolean(input.allowArchived));
  }

  if (input.slug !== undefined && input.slug !== null) {
    return resolveWorkspaceBySlug(input.slug, Boolean(input.allowArchived));
  }

  throw new WorkspaceResolutionError('Workspace identifier is required', 400);
}
