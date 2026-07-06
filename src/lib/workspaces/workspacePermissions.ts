import type { UserRole } from '@/lib/auth/roleUtils';
import type { Workspace, WorkspaceSummary } from './workspaceTypes';

export interface WorkspaceAccessSubject {
  uid?: string;
  role?: UserRole;
  workspace?: WorkspaceSummary | null;
  workspaceId?: string;
}

export interface WorkspaceAccessOptions {
  allowArchived?: boolean;
}
const privilegedRoles = new Set<UserRole>(['admin','manager']);
const staffRoles = new Set<UserRole>(['admin','manager','staff']);
const getSubjectWorkspaceId = (subject: WorkspaceAccessSubject): string | undefined => subject.workspace?.id ?? subject.workspaceId;

export const isWorkspaceOwner = (subject: WorkspaceAccessSubject, workspace: Workspace): boolean => Boolean(subject.uid && workspace.ownerId && subject.uid === workspace.ownerId);
export const canAccessWorkspace = (subject: WorkspaceAccessSubject, workspace: Workspace, options: WorkspaceAccessOptions = {}): boolean => {
  if (workspace.status === 'ARCHIVED' && !options.allowArchived) return false;
  if (privilegedRoles.has(subject.role as UserRole)) return true;
  if (isWorkspaceOwner(subject, workspace)) return true;
  return getSubjectWorkspaceId(subject) === workspace.workspaceId;
};
export const canManageWorkspace = (subject: WorkspaceAccessSubject, workspace: Workspace, options: WorkspaceAccessOptions = {}): boolean => {
  if (workspace.status === 'ARCHIVED' && !options.allowArchived) return false;
  if (privilegedRoles.has(subject.role as UserRole)) return true;
  return isWorkspaceOwner(subject, workspace);
};
export const canViewWorkspace = (subject: WorkspaceAccessSubject, workspace: Workspace, options: WorkspaceAccessOptions = {}): boolean => canAccessWorkspace(subject, workspace, options) || staffRoles.has(subject.role as UserRole);
